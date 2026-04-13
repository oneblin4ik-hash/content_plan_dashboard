import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Check, Zap, Sparkles, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

export default function ContentGenerator() {
  const [title, setTitle] = useState("");
  const [selectedTab, setSelectedTab] = useState("post");
  const [tone, setTone] = useState("expert");
  const [duration, setDuration] = useState("15-30s");
  const [includePost, setIncludePost] = useState(true);
  const [includeReels, setIncludeReels] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // tRPC mutations
  const generatePostMutation = trpc.content.generatePost.useMutation();
  const generateReelsScriptMutation = trpc.content.generateReelsScript.useMutation();
  const generateFullContentMutation = trpc.content.generateFullContent.useMutation();

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGeneratePost = async () => {
    if (!title.trim()) return;
    await generatePostMutation.mutateAsync({
      title,
      tone: tone as "expert" | "friend" | "provocative",
      platform: "telegram",
    });
  };

  const handleGenerateReels = async () => {
    if (!title.trim()) return;
    await generateReelsScriptMutation.mutateAsync({
      title,
      duration: duration as "15-30s" | "30-60s",
    });
  };

  const handleGenerateFull = async () => {
    if (!title.trim()) return;
    await generateFullContentMutation.mutateAsync({
      title,
      includePost,
      includeReelsScript: includeReels,
    });
  };

  const isLoading =
    generatePostMutation.isPending ||
    generateReelsScriptMutation.isPending ||
    generateFullContentMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-border">
        <div className="container py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-primary" />
                Генератор контента
              </h1>
              <p className="text-muted-foreground mt-1">
                Создавай готовые посты и сценарии Reels за секунды
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container py-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Input Section */}
          <div className="md:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Параметры</CardTitle>
                <CardDescription>Введи заголовок и выбери параметры</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Заголовок темы</label>
                  <Input
                    placeholder="Например: Почему девушки толстеют от углеводов"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-2"
                    disabled={isLoading}
                  />
                </div>

                <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="post">Пост</TabsTrigger>
                    <TabsTrigger value="reels">Reels</TabsTrigger>
                  </TabsList>

                  <TabsContent value="post" className="space-y-4 mt-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Тон голоса</label>
                      <Select value={tone} onValueChange={setTone} disabled={isLoading}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="expert">Экспертный</SelectItem>
                          <SelectItem value="friend">Дружеский</SelectItem>
                          <SelectItem value="provocative">Провокационный</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleGeneratePost}
                      disabled={!title.trim() || isLoading}
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Генерирую...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Создать пост
                        </>
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="reels" className="space-y-4 mt-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Длительность</label>
                      <Select value={duration} onValueChange={setDuration} disabled={isLoading}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15-30s">15-30 секунд</SelectItem>
                          <SelectItem value="30-60s">30-60 секунд</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleGenerateReels}
                      disabled={!title.trim() || isLoading}
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Генерирую...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" />
                          Создать сценарий
                        </>
                      )}
                    </Button>
                  </TabsContent>
                </Tabs>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Создать всё сразу</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-post"
                        checked={includePost}
                        onCheckedChange={(checked) => setIncludePost(checked as boolean)}
                        disabled={isLoading}
                      />
                      <label htmlFor="include-post" className="text-sm cursor-pointer">
                        Пост для Telegram
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="include-reels"
                        checked={includeReels}
                        onCheckedChange={(checked) => setIncludeReels(checked as boolean)}
                        disabled={isLoading}
                      />
                      <label htmlFor="include-reels" className="text-sm cursor-pointer">
                        Сценарий Reels
                      </label>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerateFull}
                    disabled={!title.trim() || isLoading || (!includePost && !includeReels)}
                    className="w-full mt-4"
                    variant="outline"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Генерирую...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Создать всё
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="md:col-span-2 space-y-6">
            {/* Post Result */}
            {(generatePostMutation.data || (generateFullContentMutation.data as any)?.post) && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Готовый пост</CardTitle>
                      <CardDescription>Для Telegram канала</CardDescription>
                    </div>
                    <Badge>Готово</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-secondary/50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    <Streamdown>
                      {(generatePostMutation.data?.post as string) || (generateFullContentMutation.data?.post as string) || ""}
                    </Streamdown>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const text = ((generatePostMutation.data?.post as string) || (generateFullContentMutation.data?.post as string) || "");
                      handleCopy(text, "post");
                    }}
                  >
                    {copiedId === "post" ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Скопировано!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Скопировать пост
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Reels Script Result */}
            {(generateReelsScriptMutation.data || (generateFullContentMutation.data as any)?.reelsScript) && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Сценарий Reels</CardTitle>
                      <CardDescription>Для Instagram</CardDescription>
                    </div>
                    <Badge variant="secondary">Готово</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-secondary/50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    <Streamdown>
                      {(generateReelsScriptMutation.data?.script as string) || (generateFullContentMutation.data?.reelsScript as string) || ""}
                    </Streamdown>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const text = ((generateReelsScriptMutation.data?.script as string) || (generateFullContentMutation.data?.reelsScript as string) || "");
                      handleCopy(text, "reels");
                    }}
                  >
                    {copiedId === "reels" ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Скопировано!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Скопировать сценарий
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Empty State */}
            {!generatePostMutation.data &&
              !generateReelsScriptMutation.data &&
              !generateFullContentMutation.data?.post &&
              !generateFullContentMutation.data?.reelsScript && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Sparkles className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground text-center">
                      Введи заголовок и нажми кнопку генерации
                    </p>
                    <p className="text-sm text-muted-foreground text-center mt-2">
                      AI создаст готовый контент за несколько секунд
                    </p>
                  </CardContent>
                </Card>
              )}

            {/* Error State */}
            {(generatePostMutation.error ||
              generateReelsScriptMutation.error ||
              generateFullContentMutation.error) && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <p className="text-red-700 text-sm">
                    Ошибка при генерации:{" "}
                    {generatePostMutation.error?.message ||
                      generateReelsScriptMutation.error?.message ||
                      generateFullContentMutation.error?.message}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/50 mt-12">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>Генератор контента • Создавай вирусный контент за секунды</p>
        </div>
      </footer>
    </div>
  );
}
