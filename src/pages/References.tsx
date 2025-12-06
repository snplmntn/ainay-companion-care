import { ArrowLeft, ExternalLink, Database, AlertTriangle, Pill, Heart, BookOpen, Shield, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function References() {
  const navigate = useNavigate();

  const dataSources = [
    {
      title: "Philippine FDA - List of Registered Drugs",
      description:
        "Official database of FDA-registered drugs in the Philippines. Used for medicine recognition, validation, and autocomplete suggestions.",
      url: "https://verification.fda.gov.ph/drug_productslist.php",
      icon: Pill,
      color: "from-blue-500 to-cyan-500",
      badge: "Official Source",
      badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    },
    {
      title: "Drug-Drug Interactions (DDI)",
      description:
        "Comprehensive dataset of drug-drug interactions including severity levels, mechanisms, clinical effects, and safer alternatives.",
      url: "https://www.kaggle.com/datasets/shayanhusain/drug-drug-interactions-management-and-safer-alters",
      icon: AlertTriangle,
      color: "from-amber-500 to-orange-500",
      badge: "Kaggle Dataset",
      badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    },
    {
      title: "Drug-Food Interactions (DFI)",
      description:
        "Dataset containing food interaction warnings for various medications to help users avoid adverse effects.",
      url: "https://www.kaggle.com/datasets/shayanhusain/drug-food-interactions-dataset",
      icon: Database,
      color: "from-emerald-500 to-teal-500",
      badge: "Kaggle Dataset",
      badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    },
  ];

  const studies = [
    {
      title: "WHO Global Study on Medication Adherence",
      description:
        "World Health Organization study on adherence to long-term therapies, providing evidence for policy and action.",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3068890/",
      badge: "WHO",
      badgeColor: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
    },
    {
      title: "Cebu Study on Medication Compliance",
      description:
        "Philippine Academy of Family Physicians study examining medication adherence patterns among Filipino patients in Cebu.",
      url: "https://thepafp.org/journal/wp-content/uploads/2024/07/PAFP-Journal-62-1_83-88.pdf",
      badge: "Philippines",
      badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
    },
    {
      title: "Mindoro Study on Healthcare Access",
      description:
        "Research on healthcare challenges and medication management among communities in Oriental Mindoro, Philippines.",
      url: "https://ijcsrr.org/wp-content/uploads/2024/05/94-2905-2024.pdf",
      badge: "Philippines",
      badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
    },
    {
      title: "Treat or Eat: Financial Barriers to Medication",
      description:
        "Study examining the difficult choices patients face between affording medication and basic necessities like food.",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8678375/",
      badge: "Research",
      badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
    },
    {
      title: "Polypharmacy in Older Adults",
      description:
        "Comprehensive review of polypharmacy challenges, including medication interactions and adherence difficulties in elderly patients.",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7392925/",
      badge: "Research",
      badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
    },
    {
      title: "Polypharmacy & Cognitive Impairment",
      description:
        "Research on the relationship between multiple medication use and cognitive decline in older populations.",
      url: "https://pubmed.ncbi.nlm.nih.gov/39111065/",
      badge: "Research",
      badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-violet-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header with AInay Branding */}
      <header className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-white hover:bg-white/20 rounded-full"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity bg-white rounded-full pl-1.5 pr-3 py-1.5 shadow-lg"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="font-bold text-violet-600 text-sm">AInay</span>
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Data Sources & References
              </h1>
              <p className="text-white/80 text-base mt-1">
                Trusted open data sources powering AInay
              </p>
            </div>
          </div>
        </div>
        <div className="h-8 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-950" />
      </header>

      {/* Content */}
      <main className="px-4 md:px-8 pb-12 -mt-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Disclaimer */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800/50 rounded-3xl p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-amber-800 dark:text-amber-200 mb-2">
                  Medical Disclaimer
                </h3>
                <p className="text-amber-700 dark:text-amber-300 leading-relaxed">
                  The information provided by <span className="font-semibold">AInay</span> is for informational purposes
                  only and should not replace professional medical advice. Always consult a healthcare 
                  provider for medication decisions.
                </p>
              </div>
            </div>
          </div>

          {/* Introduction */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-xl border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Our Data Commitment</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              <span className="font-semibold text-primary">AInay</span> is committed to providing accurate and 
              reliable medication information to Filipino families. We source our data from trusted, 
              open databases and continuously update our systems to ensure you have access to the 
              most current information available.
            </p>
          </div>

          {/* Data Sources */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground px-2">Data Sources</h2>

            {dataSources.map((source, index) => (
              <a
                key={index}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-lg border border-border/50 hover:shadow-xl hover:border-primary/30 transition-all group hover:-translate-y-1"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${source.color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
                    <source.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                        {source.title}
                      </h3>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${source.badgeColor}`}>
                        {source.badge}
                      </span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors ml-auto flex-shrink-0" />
                    </div>
                    <p className="text-muted-foreground mb-3 leading-relaxed">
                      {source.description}
                    </p>
                    <p className="text-sm text-primary/70 truncate font-mono">
                      {source.url}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* Research Studies */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <GraduationCap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-xl font-bold text-foreground">Research Studies</h2>
            </div>
            <p className="text-muted-foreground px-2 mb-4">
              Academic research and studies that inform AInay's understanding of medication adherence challenges.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              {studies.map((study, index) => (
                <a
                  key={index}
                  href={study.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-lg border border-border/50 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group hover:-translate-y-1"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-semibold text-sm text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                          {study.title}
                        </h3>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${study.badgeColor} inline-block mb-2`}>
                        {study.badge}
                      </span>
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
                        {study.description}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Attribution */}
          <div className="bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-indigo-500/10 rounded-3xl p-6 md:p-8 border border-violet-200/50 dark:border-violet-800/30">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              <h3 className="font-bold text-lg">Attribution & Acknowledgments</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Drug-Drug Interactions and Drug-Food Interactions datasets are provided by{" "}
              <a
                href="https://www.kaggle.com/shayanhusain"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-semibold"
              >
                Shayan Husain
              </a>{" "}
              on Kaggle. The Philippine FDA drug database is sourced from the official 
              FDA Philippines verification portal. We extend our gratitude to these 
              organizations and individuals for making this data publicly available.
            </p>
          </div>

          {/* Back Button */}
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
