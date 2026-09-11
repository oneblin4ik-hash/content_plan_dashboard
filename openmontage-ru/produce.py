#!/usr/bin/env python3
"""Russian talking-head montage on OpenMontage, free tools only.

Runs the talking-head pipeline stages against one vertical clip:

    analyze -> transcribe -> enhance -> subtitles -> captions+overlays -> QA

Every stage uses a tool that works with no API key: faster-whisper for
speech, ffmpeg for audio/colour, Remotion for animated captions.

Usage:
    PYTHONPATH=<openmontage-root> python produce.py INPUT.mp4 --outdir OUT

Environment:
    OPENMONTAGE_ROOT   OpenMontage checkout (default: /home/user/calesthio/openmontage)
    REMOTION_BROWSER_EXECUTABLE
                       Chromium for the Remotion render. Required where
                       Remotion cannot download its own browser.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(os.environ.get("OPENMONTAGE_ROOT", "/home/user/calesthio/openmontage"))
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def log(stage: str, msg: str) -> None:
    print(f"[{stage:<11}] {msg}", flush=True)


def probe(path: Path) -> dict:
    """ffprobe the container. Duration/fps drive later stage decisions."""
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-print_format", "json",
            "-show_format", "-show_streams", str(path),
        ],
        capture_output=True, text=True, check=True,
    )
    data = json.loads(out.stdout)
    video = next(s for s in data["streams"] if s["codec_type"] == "video")
    audio = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
    num, den = (video.get("r_frame_rate") or "30/1").split("/")
    return {
        "width": int(video["width"]),
        "height": int(video["height"]),
        "fps": round(int(num) / max(int(den), 1), 3),
        "duration": float(data["format"]["duration"]),
        "has_audio": audio is not None,
        "video_codec": video["codec_name"],
        "audio_codec": audio["codec_name"] if audio else None,
    }


def _transcript_fingerprint(src: Path, model: str, language: str) -> str:
    """Identify the exact (clip, model, language) a cached transcript belongs to."""
    digest = hashlib.sha256()
    with src.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    digest.update(f"|{model}|{language}".encode())
    return digest.hexdigest()


def stage_transcribe(src: Path, outdir: Path, model: str, language: str) -> dict:
    """Word-level Russian transcript via faster-whisper (offline, free)."""
    from tools.analysis.transcriber import Transcriber

    cache = outdir / "transcript.json"
    # Reusing an --outdir across clips, models or languages must not burn the
    # previous run's text and word timings onto the new video, so the cache is
    # only good for the exact input it was produced from.
    fingerprint = _transcript_fingerprint(src, model, language)
    if cache.exists():
        cached = json.loads(cache.read_text(encoding="utf-8"))
        if cached.get("_fingerprint") == fingerprint:
            log("transcribe", f"reusing {cache.name}")
            return cached
        log("transcribe", f"{cache.name} is from a different input — re-transcribing")

    started = time.time()
    result = Transcriber().execute({
        "input_path": str(src),
        "model_size": model,
        "language": language,
        "word_timestamps": True,
    })
    if not result.success:
        raise SystemExit(f"transcription failed: {result.error}")

    data = dict(result.data)
    data["_fingerprint"] = fingerprint
    cache.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    segs = data["segments"]
    words = sum(len(s.get("words") or []) for s in segs)
    log("transcribe", f"{len(segs)} segments / {words} words in {time.time()-started:.0f}s")
    return data


def stage_subtitles(transcript: dict, outdir: Path) -> Path:
    """A standalone .srt alongside the burned-in captions."""
    from tools.subtitle.subtitle_gen import SubtitleGen

    srt = outdir / "subtitles.ru.srt"
    result = SubtitleGen().execute({
        "segments": transcript["segments"],
        "output_path": str(srt),
        "format": "srt",
    })
    if not result.success:
        raise SystemExit(f"subtitle generation failed: {result.error}")
    log("subtitles", f"{result.data['cue_count']} cues -> {srt.name}")
    return srt


def stage_audio(src: Path, outdir: Path) -> Path | None:
    """Noise gate + compression + normalisation, remuxed onto the video."""
    from tools.audio.audio_enhance import AudioEnhance

    # audio_enhance encodes with audio_codec (default aac) regardless of the
    # extension, so a .wav target yields AAC in a WAV container that ffmpeg
    # then refuses to decode. Ask for the container the codec belongs in.
    cleaned = outdir / "audio_enhanced.m4a"
    result = AudioEnhance().execute({
        "input_path": str(src),
        "output_path": str(cleaned),
        "audio_codec": "aac",
    })
    if not result.success:
        log("audio", f"enhancement skipped: {result.error}")
        return None

    remuxed = outdir / "step_audio.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-i", str(src), "-i", str(cleaned),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest", str(remuxed),
        ],
        check=True,
    )
    log("audio", f"enhanced -> {remuxed.name}")
    return remuxed


def stage_grade(src: Path, outdir: Path, preset: str) -> Path:
    """LUT-style colour grade. Re-encodes, so it runs before the caption burn."""
    from tools.enhancement.color_grade import ColorGrade

    graded = outdir / "step_graded.mp4"
    result = ColorGrade().execute({
        "input_path": str(src),
        "output_path": str(graded),
        "preset": preset,
    })
    if not result.success:
        log("grade", f"skipped: {result.error}")
        return src
    log("grade", f"{preset} -> {graded.name}")
    return graded


def stage_faces(src: Path) -> dict | None:
    """Face positions. Informational here; drives reframing on non-9:16 sources."""
    from tools.analysis.face_tracker import FaceTracker

    result = FaceTracker().execute({"input_path": str(src), "sample_fps": 2})
    if not result.success:
        log("faces", f"skipped: {result.error}")
        return None
    log(
        "faces",
        f"{result.data['faces_detected']}/{result.data['frames_sampled']} sampled "
        f"frames via {result.data['method']}",
    )
    return result.data


def stage_captions(
    src: Path,
    transcript: dict,
    overlays: list[dict],
    outdir: Path,
    words_per_page: int,
    font_size: int,
    highlight: str,
    corrections: dict[str, str],
) -> Path:
    """Animated word-by-word captions plus timed overlay cards, via Remotion."""
    from tools.video.remotion_caption_burn import RemotionCaptionBurn

    final = outdir / "final.mp4"
    started = time.time()
    result = RemotionCaptionBurn().execute({
        "input_path": str(src),
        "output_path": str(final),
        "segments": transcript["segments"],
        "words_per_page": words_per_page,
        "font_size": font_size,
        "highlight_color": highlight,
        "corrections": corrections,
        "overlays": overlays,
    })
    if not result.success:
        raise SystemExit(f"caption burn failed: {result.error}")
    log(
        "captions",
        f"{result.data['caption_count']} captions + {result.data['overlay_count']} "
        f"overlays via {result.data['method']} in {time.time()-started:.0f}s",
    )
    return final


def stage_qa(final: Path, outdir: Path) -> dict:
    """Post-render self-review: container probe, audio levels, sampled frames."""
    from tools.analysis.visual_qa import VisualQA

    report: dict = {}
    for operation in ("probe", "audio_levels", "review"):
        result = VisualQA().execute({
            "operation": operation,
            "input_path": str(final),
            "output_dir": str(outdir / "qa"),
        })
        report[operation] = result.data if result.success else {"error": result.error}

    probe_data = report.get("probe", {})
    issues = list(probe_data.get("validation_issues") or [])
    if not probe_data.get("has_audio"):
        issues.append("output has no audio track")

    levels = (report.get("audio_levels") or {}).get("levels") or []
    if levels:
        peak = max(entry["max_volume_db"] for entry in levels)
        if peak > -0.5:
            issues.append(f"audio peaks at {peak} dB — clipping risk")
        if peak < -12:
            issues.append(f"audio peaks at only {peak} dB — too quiet")

    report["issues"] = issues
    log("qa", "clean" if not issues else f"{len(issues)} issue(s): {issues}")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="source vertical clip")
    parser.add_argument("--outdir", type=Path, default=Path("out"))
    parser.add_argument("--overlays", type=Path, help="JSON array of overlay cards")
    parser.add_argument("--corrections", type=Path, help="JSON map of word fixes")
    parser.add_argument("--model", default="large-v3", help="faster-whisper model")
    parser.add_argument("--language", default="ru")
    parser.add_argument("--words-per-page", type=int, default=3)
    parser.add_argument("--font-size", type=int, default=64)
    parser.add_argument("--highlight", default="#FFD166")
    parser.add_argument("--grade", default="cinematic", help="colour preset, or 'none'")
    parser.add_argument("--skip-audio", action="store_true")
    args = parser.parse_args()

    if not args.input.is_file():
        raise SystemExit(f"no such file: {args.input}")
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is not on PATH")

    outdir = args.outdir
    outdir.mkdir(parents=True, exist_ok=True)

    meta = probe(args.input)
    log("analyze", json.dumps(meta, ensure_ascii=False))
    if not meta["has_audio"]:
        raise SystemExit("source has no audio track — nothing to transcribe")
    if meta["width"] > meta["height"]:
        log("analyze", "WARNING: source is landscape, expected vertical")

    overlays = json.loads(args.overlays.read_text(encoding="utf-8")) if args.overlays else []
    corrections = (
        json.loads(args.corrections.read_text(encoding="utf-8")) if args.corrections else {}
    )

    transcript = stage_transcribe(args.input, outdir, args.model, args.language)
    stage_subtitles(transcript, outdir)
    stage_faces(args.input)

    working = args.input
    if not args.skip_audio:
        working = stage_audio(working, outdir) or working
    if args.grade != "none":
        working = stage_grade(working, outdir, args.grade)

    final = stage_captions(
        working, transcript, overlays, outdir,
        args.words_per_page, args.font_size, args.highlight, corrections,
    )
    report = stage_qa(final, outdir)

    (outdir / "render_report.json").write_text(
        json.dumps({"source": meta, "qa": report}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    log("done", f"{final} ({final.stat().st_size / 1e6:.1f} MB)")
    return 1 if report["issues"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
