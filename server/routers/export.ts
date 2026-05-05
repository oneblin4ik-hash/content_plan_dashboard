import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { PDFDocument, rgb, degrees } from "pdf-lib";
import * as ExcelJS from "exceljs";

export const exportRouter = router({
  exportPDF: publicProcedure
    .input(
      z.object({
        topics: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
            interest: z.string(),
            format: z.string(),
            potential: z.string(),
            published: z.boolean().optional(),
            views: z.number().optional(),
            engagement: z.number().optional(),
          })
        ),
        reels: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            script: z.string(),
            published: z.boolean().optional(),
          })
        ),
        tactics: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); // A4 size
        const { width, height } = page.getSize();

        // Title
        page.drawText("Content Plan Dashboard Report", {
          x: 50,
          y: height - 50,
          size: 24,
          color: rgb(0.4, 0.25, 0.15),
        });

        // Date
        page.drawText(`Generated: ${new Date().toLocaleDateString()}`, {
          x: 50,
          y: height - 80,
          size: 10,
          color: rgb(0.5, 0.5, 0.5),
        });

        // Topics section
        let yPosition = height - 120;
        page.drawText("Content Topics", {
          x: 50,
          y: yPosition,
          size: 14,
          color: rgb(0.4, 0.25, 0.15),
        });
        yPosition -= 20;

        input.topics.slice(0, 10).forEach((topic) => {
          if (yPosition < 100) {
            const newPage = pdfDoc.addPage([595, 842]);
            yPosition = 800;
          }

          page.drawText(`• ${topic.title}`, {
            x: 60,
            y: yPosition,
            size: 10,
            color: rgb(0.2, 0.2, 0.2),
          });
          yPosition -= 15;

          page.drawText(`  ${topic.description}`, {
            x: 70,
            y: yPosition,
            size: 8,
            color: rgb(0.5, 0.5, 0.5),
          });
          yPosition -= 12;
        });

        const pdfBytes = await pdfDoc.save();
        return {
          success: true,
          data: Buffer.from(pdfBytes).toString("base64"),
          filename: `content-plan-${Date.now()}.pdf`,
        };
      } catch (error) {
        console.error("PDF generation error:", error);
        throw new Error("Failed to generate PDF");
      }
    }),

  exportExcel: publicProcedure
    .input(
      z.object({
        topics: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
            interest: z.string(),
            format: z.string(),
            potential: z.string(),
            published: z.boolean().optional(),
            views: z.number().optional(),
            engagement: z.number().optional(),
          })
        ),
        reels: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            script: z.string(),
            published: z.boolean().optional(),
          })
        ),
        tactics: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            description: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const workbook = new ExcelJS.Workbook();

        // Topics sheet
        const topicsSheet = workbook.addWorksheet("Topics");
        topicsSheet.columns = [
          { header: "Title", key: "title", width: 30 },
          { header: "Description", key: "description", width: 40 },
          { header: "Interest", key: "interest", width: 15 },
          { header: "Format", key: "format", width: 15 },
          { header: "Potential", key: "potential", width: 12 },
          { header: "Published", key: "published", width: 10 },
          { header: "Views", key: "views", width: 10 },
          { header: "Engagement %", key: "engagement", width: 12 },
        ];

        input.topics.forEach((topic) => {
          topicsSheet.addRow({
            title: topic.title,
            description: topic.description,
            interest: topic.interest,
            format: topic.format,
            potential: topic.potential,
            published: topic.published ? "Yes" : "No",
            views: topic.views || 0,
            engagement: topic.engagement || 0,
          });
        });

        // Reels sheet
        const reelsSheet = workbook.addWorksheet("Reels Scripts");
        reelsSheet.columns = [
          { header: "Title", key: "title", width: 30 },
          { header: "Script", key: "script", width: 60 },
          { header: "Published", key: "published", width: 10 },
        ];

        input.reels.forEach((reel) => {
          reelsSheet.addRow({
            title: reel.title,
            script: reel.script,
            published: reel.published ? "Yes" : "No",
          });
        });

        // Tactics sheet
        const tacticsSheet = workbook.addWorksheet("Tactics");
        tacticsSheet.columns = [
          { header: "Title", key: "title", width: 30 },
          { header: "Description", key: "description", width: 60 },
        ];

        input.tactics.forEach((tactic) => {
          tacticsSheet.addRow({
            title: tactic.title,
            description: tactic.description,
          });
        });

        // Statistics sheet
        const statsSheet = workbook.addWorksheet("Statistics");
        const totalTopics = input.topics.length;
        const publishedTopics = input.topics.filter((t) => t.published).length;
        const totalViews = input.topics.reduce((sum, t) => sum + (t.views || 0), 0);
        const avgEngagement =
          input.topics.reduce((sum, t) => sum + (t.engagement || 0), 0) /
          Math.max(input.topics.length, 1);

        statsSheet.addRow(["Metric", "Value"]);
        statsSheet.addRow(["Total Topics", totalTopics]);
        statsSheet.addRow(["Published Topics", publishedTopics]);
        statsSheet.addRow(["Total Views", totalViews]);
        statsSheet.addRow(["Average Engagement %", avgEngagement.toFixed(2)]);
        statsSheet.addRow(["Total Reels Scripts", input.reels.length]);
        statsSheet.addRow(["Total Tactics", input.tactics.length]);

        const buffer = await workbook.xlsx.writeBuffer();
        return {
          success: true,
          data: Buffer.from(buffer).toString("base64"),
          filename: `content-plan-${Date.now()}.xlsx`,
        };
      } catch (error) {
        console.error("Excel generation error:", error);
        throw new Error("Failed to generate Excel");
      }
    }),
});
