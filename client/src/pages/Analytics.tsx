import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Eye, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { allContentTopics } from "@/lib/contentData";

export default function Analytics() {
  const [publishedTopics, setPublishedTopics] = useState<Record<number, boolean>>({});
  const [viewStats, setViewStats] = useState<Record<number, number>>({});
  const [engagementStats, setEngagementStats] = useState<Record<number, number>>({});

  const handleTogglePublished = (id: number) => {
    setPublishedTopics(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleViewsChange = (id: number, views: string) => {
    setViewStats(prev => ({
      ...prev,
      [id]: parseInt(views) || 0
    }));
  };

  const handleEngagementChange = (id: number, engagement: string) => {
    setEngagementStats(prev => ({
      ...prev,
      [id]: parseFloat(engagement) || 0
    }));
  };

  const publishedCount = Object.values(publishedTopics).filter(Boolean).length;
  const totalViews = Object.values(viewStats).reduce((a, b) => a + b, 0);
  const avgEngagement = Object.values(engagementStats).length > 0
    ? (Object.values(engagementStats).reduce((a, b) => a + b, 0) / Object.values(engagementStats).length).toFixed(2)
    : "0.00";

  // Data for charts
  const chartData = allContentTopics
    .filter(topic => publishedTopics[topic.id])
    .map(topic => ({
      name: topic.title.substring(0, 20) + "...",
      views: viewStats[topic.id] || 0,
      engagement: engagementStats[topic.id] || 0
    }));

  const performanceData = [
    { name: "Опубликовано", value: publishedCount },
    { name: "В очереди", value: allContentTopics.length - publishedCount }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                Трекер Выполнения
              </h1>
              <p className="text-muted-foreground mt-1">
                Отслеживание опубликованного контента и статистики просмотров
              </p>
            </div>
            <div className="hidden md:block">
              <TrendingUp className="w-12 h-12 text-primary opacity-70" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Опубликовано
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{publishedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">из {allContentTopics.length} тем</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Всего просмотров
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{totalViews.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">по всем постам</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Средний Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{avgEngagement}%</div>
              <p className="text-xs text-muted-foreground mt-1">средний показатель</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                В очереди
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {allContentTopics.length - publishedCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">ожидают публикации</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Просмотры по постам</CardTitle>
                <CardDescription>Статистика просмотров опубликованного контента</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="views" fill="#d97706" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engagement Rate</CardTitle>
                <CardDescription>Уровень взаимодействия аудитории</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="engagement" stroke="#d97706" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Topics Tracker */}
        <Card>
          <CardHeader>
            <CardTitle>Трекер тем контента</CardTitle>
            <CardDescription>Отметьте опубликованные темы и добавьте статистику</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allContentTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-start gap-4 p-4 border border-border rounded-lg hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id={`topic-${topic.id}`}
                      checked={publishedTopics[topic.id] || false}
                      onCheckedChange={() => handleTogglePublished(topic.id)}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <label
                      htmlFor={`topic-${topic.id}`}
                      className={`font-semibold cursor-pointer ${
                        publishedTopics[topic.id] ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {topic.title}
                    </label>
                    <p className="text-sm text-muted-foreground mt-1">{topic.reason}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{topic.format}</Badge>
                      <Badge className={topic.potential === "Вирусный" ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"}>
                        {topic.potential}
                      </Badge>
                    </div>
                  </div>

                  {publishedTopics[topic.id] && (
                    <div className="flex gap-3 flex-col sm:flex-row">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Просмотры</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={viewStats[topic.id] || ""}
                          onChange={(e) => handleViewsChange(topic.id, e.target.value)}
                          className="w-24 h-8 text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Engagement %</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          value={engagementStats[topic.id] || ""}
                          onChange={(e) => handleEngagementChange(topic.id, e.target.value)}
                          className="w-24 h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {publishedTopics[topic.id] && (
                    <div className="flex items-center gap-1 text-green-600 pt-1">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-3 mt-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Лучший пост
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div>
                  <p className="text-lg font-bold text-primary">
                    {Math.max(...chartData.map(d => d.views)).toLocaleString()} просмотров
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {chartData.find(d => d.views === Math.max(...chartData.map(d => d.views)))?.name}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">Нет опубликованных постов</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Лучший Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <div>
                  <p className="text-lg font-bold text-primary">
                    {Math.max(...chartData.map(d => d.engagement)).toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {chartData.find(d => d.engagement === Math.max(...chartData.map(d => d.engagement)))?.name}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">Нет опубликованных постов</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Прогресс
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <p className="text-lg font-bold text-primary">
                  {Math.round((publishedCount / allContentTopics.length) * 100)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {publishedCount} из {allContentTopics.length} тем
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/50 mt-12">
        <div className="container py-8 text-center text-sm text-muted-foreground">
          <p>Трекер выполнения контента • Отслеживай ROI каждого поста</p>
        </div>
      </footer>
    </div>
  );
}
