import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Zap, Target, BookOpen, TrendingUp, Copy, Check, CheckCircle2, Download } from "lucide-react";
import { allContentTopics, allReelsScripts, allTactics } from "@/lib/contentData";
import { trpc } from "@/lib/trpc";

const contentTopics = allContentTopics;
const reelsScripts = allReelsScripts;
const tactics = allTactics;

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("topics");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [publishedTopics, setPublishedTopics] = useState<Record<number, boolean>>({});
  const [isExporting, setIsExporting] = useState(false);

  const exportPDFMutation = trpc.export.exportPDF.useMutation();
  const exportExcelMutation = trpc.export.exportExcel.useMutation();

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const result = await exportPDFMutation.mutateAsync({
        topics: contentTopics.map(t => ({
          id: String(t.id),
          title: t.title,
          description: t.reason,
          interest: t.interest,
          format: t.format,
          potential: t.potential,
          published: publishedTopics[t.id] || false,
          views: t.views,
          engagement: t.engagementRate,
        })),
        reels: reelsScripts.map(r => ({
          id: String(r.id),
          title: r.title,
          script: r.hook + " " + (r.body || "") + " " + r.trigger + " " + r.cta,
          published: r.published,
        })),
        tactics: tactics.map(t => ({
          id: String(t.id),
          title: t.title,
          description: t.description,
        })),
      });
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${result.data}`;
      link.download = result.filename;
      link.click();
    } catch (error) {
      console.error("Export PDF failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const result = await exportExcelMutation.mutateAsync({
        topics: contentTopics.map(t => ({
          id: String(t.id),
          title: t.title,
          description: t.reason,
          interest: t.interest,
          format: t.format,
          potential: t.potential,
          published: publishedTopics[t.id] || false,
          views: t.views,
          engagement: t.engagementRate,
        })),
        reels: reelsScripts.map(r => ({
          id: String(r.id),
          title: r.title,
          script: r.hook + " " + (r.body || "") + " " + r.trigger + " " + r.cta,
          published: r.published,
        })),
        tactics: tactics.map(t => ({
          id: String(t.id),
          title: t.title,
          description: t.description,
        })),
      });
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.data}`;
      link.download = result.filename;
      link.click();
    } catch (error) {
      console.error("Export Excel failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTogglePublished = (id: number) => {
    setPublishedTopics(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredTopics = contentTopics.filter(topic =>
    topic.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case "Вирусный":
        return "bg-red-100 text-red-800";
      case "Высокий":
        return "bg-orange-100 text-orange-800";
      case "Средний":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-border">
        <div className="container py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Стратегический план контента
              </h1>
              <p className="text-muted-foreground mt-1">
                Для Эдуарда Серболина • Фитнес-тренер
              </p>
            </div>
            <div className="hidden md:block">
              <TrendingUp className="w-12 h-12 text-primary opacity-70" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container py-8">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="topics" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Темы</span>
            </TabsTrigger>
            <TabsTrigger value="reels" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Reels</span>
            </TabsTrigger>
            <TabsTrigger value="tactics" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Тактики</span>
            </TabsTrigger>
          </TabsList>

          {/* Topics Tab */}
          <TabsContent value="topics" className="space-y-6">
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по темам..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="bg-blue-500 hover:bg-blue-600 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                PDF
              </Button>
              <Button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="bg-green-500 hover:bg-green-600 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Excel
              </Button>
            </div>

            <div className="grid gap-4">
              {filteredTopics.map((topic) => (
                <Card key={topic.id} className={`card-hover ${publishedTopics[topic.id] ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className={`text-lg ${publishedTopics[topic.id] ? 'line-through text-muted-foreground' : ''}`}>
                          {topic.title}
                        </CardTitle>
                        <CardDescription className="mt-2">{topic.reason}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTogglePublished(topic.id)}
                          className="flex-shrink-0"
                          title={publishedTopics[topic.id] ? "Отметить как неопубликованное" : "Отметить как опубликованное"}
                        >
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            publishedTopics[topic.id]
                              ? 'bg-green-500 border-green-500'
                              : 'border-gray-300 hover:border-green-500'
                          }`}>
                            {publishedTopics[topic.id] && (
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            )}
                          </div>
                        </button>
                        <Badge className={getPotentialColor(topic.potential)}>
                          {topic.potential}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Интерес:</span>
                        <Badge variant="outline">{topic.interest}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Формат:</span>
                        <Badge variant="secondary">{topic.format}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center text-sm text-muted-foreground mt-8">
              Показано {filteredTopics.length} из {contentTopics.length} тем
            </div>
          </TabsContent>

          {/* Reels Tab */}
          <TabsContent value="reels" className="space-y-6">
            <div className="grid gap-4">
              {reelsScripts.map((script) => (
                <Card key={script.id} className="card-hover">
                  <CardHeader>
                    <CardTitle className="text-lg">{script.title}</CardTitle>
                  </CardHeader>
                      <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm text-primary mb-2">Хук:</h4>
                      <p className="text-sm text-foreground">{script.hook}</p>
                    </div>
                    {script.body && (
                      <div>
                        <h4 className="font-semibold text-sm text-primary mb-2">Тело:</h4>
                        <p className="text-sm text-foreground">{script.body}</p>
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-sm text-primary mb-2">Триггер:</h4>
                      <p className="text-sm text-foreground">{script.trigger}</p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-primary mb-2">CTA:</h4>
                      <p className="text-sm text-foreground italic">{script.cta}</p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-4"
                      onClick={() => {
                        const fullScript = `${script.title}\n\nХук: ${script.hook}\n${script.body ? `Тело: ${script.body}\n` : ''}Триггер: ${script.trigger}\n\nCTA: ${script.cta}`;
                        handleCopy(fullScript, script.id);
                      }}
                    >
                      {copiedId === script.id ? (
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
              ))}
            </div>

            <div className="text-center text-sm text-muted-foreground mt-8">
              Всего сценариев: {reelsScripts.length} из 20 (показано)
            </div>
          </TabsContent>

          {/* Tactics Tab */}
          <TabsContent value="tactics" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {tactics.map((tactic) => (
                <Card key={tactic.id} className="card-hover">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{tactic.icon}</div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{tactic.title}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-foreground">{tactic.description}</p>
                    {tactic.details && (
                      <div className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-md">
                        <p>{tactic.details}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center text-sm text-muted-foreground mt-8">
              Всего рекомендаций: {tactics.length} из 7
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/50 mt-12">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>Content Plan Dashboard • Разработано для максимизации ROI вашего контента</p>
        </div>
      </footer>
    </div>
  );
}
