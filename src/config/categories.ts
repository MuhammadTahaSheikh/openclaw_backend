export type Category = {
  id: string;
  label: string;
  keyword: string;
  /** Extra platform searches; results are merged and deduped by job id. */
  searchKeywords?: string[];
  matchTerms: string[];
  /** When true, extra filter removes platform false positives (e.g. bookkeeping). */
  strictRelevance: boolean;
};

export const categories: Category[] = [
  {
    id: "web-development",
    label: "Web Development",
    keyword: "web development",
    matchTerms: [
      "web development",
      "web developer",
      "website developer",
      "frontend",
      "backend",
      "full stack",
      "fullstack",
      "full-stack",
      "react",
      "vue",
      "angular",
      "laravel",
      "php developer",
      "javascript",
      "typescript",
      "node.js",
      "nodejs",
    ],
    strictRelevance: false,
  },
  {
    id: "seo",
    label: "SEO",
    keyword: "seo",
    matchTerms: ["seo", "search engine optimization", "search engine"],
    strictRelevance: false,
  },
  {
    id: "social-media",
    label: "Social Media",
    keyword: "social media",
    matchTerms: ["social media", "instagram", "tiktok", "facebook", "pinterest", "linkedin"],
    strictRelevance: false,
  },
  {
    id: "virtual-assistant",
    label: "Virtual Assistant",
    keyword: "virtual assistant",
    matchTerms: ["virtual assistant", " va ", "general va", "executive assistant"],
    strictRelevance: false,
  },
  {
    id: "graphic-design",
    label: "Graphic Design",
    keyword: "graphic design",
    matchTerms: ["graphic design", "graphic designer", "illustrator", "photoshop"],
    strictRelevance: false,
  },
  {
    id: "content-writing",
    label: "Content Writing",
    keyword: "content writing",
    matchTerms: ["content writing", "content writer", "copywriter", "blog writer"],
    strictRelevance: false,
  },
  {
    id: "digital-marketing",
    label: "Digital Marketing",
    keyword: "digital marketing",
    matchTerms: ["digital marketing", "marketing specialist", "ppc", "google ads", "meta ads"],
    strictRelevance: false,
  },
  {
    id: "customer-support",
    label: "Customer Support",
    keyword: "customer support",
    matchTerms: ["customer support", "customer service", "help desk", "call center"],
    strictRelevance: false,
  },
  {
    id: "data-entry",
    label: "Data Entry",
    keyword: "data entry",
    matchTerms: ["data entry", "data encoder"],
    strictRelevance: false,
  },
  {
    id: "video-editing",
    label: "Video Editing",
    keyword: "video editing",
    matchTerms: ["video editing", "video editor", "premiere pro", "after effects"],
    strictRelevance: false,
  },
  {
    id: "wordpress",
    label: "WordPress",
    keyword: "wordpress",
    matchTerms: ["wordpress", "woocommerce", "elementor"],
    strictRelevance: false,
  },
  {
    id: "ecommerce",
    label: "E-Commerce",
    keyword: "ecommerce",
    matchTerms: ["ecommerce", "e-commerce", "shopify", "amazon fba", "online store"],
    strictRelevance: false,
  },
  {
    id: "mobile-development",
    label: "Mobile Development",
    keyword: "mobile development",
    matchTerms: [
      "mobile development",
      "mobile developer",
      "ios developer",
      "android developer",
      "flutter",
      "react native",
    ],
    strictRelevance: false,
  },
  {
    id: "bookkeeping",
    label: "Bookkeeping",
    keyword: "bookkeeping",
    matchTerms: ["bookkeeping", "bookkeeper", "book keeper", "quickbooks", "quickbook", "xero"],
    strictRelevance: true,
  },
  {
    id: "lead-generation",
    label: "Lead Generation",
    keyword: "lead generation",
    matchTerms: ["lead generation", "lead gen", "appointment setter", "cold calling", "outbound"],
    strictRelevance: false,
  },
  {
    id: "ghl",
    label: "GHL (GoHighLevel, Zapier, n8n)",
    keyword: "gohighlevel",
    searchKeywords: [
      "gohighlevel",
      "zapier",
      "n8n",
      "make.com",
      "integromat",
      "activecampaign",
      "clickfunnels",
      "crm automation",
    ],
    matchTerms: [
      "gohighlevel",
      "go high level",
      "ghl",
      "highlevel",
      "high level",
      "zapier",
      "n8n",
      "make.com",
      "make com",
      "integromat",
      "activecampaign",
      "active campaign",
      "clickfunnels",
      "click funnels",
      "crm automation",
      "workflow automation",
      "automation specialist",
      "marketing automation",
    ],
    strictRelevance: false,
  },
];

export function listCategories() {
  return categories.map(({ id, label }) => ({ id, label }));
}

function findCategory(categoryIdOrLabel: string): Category | undefined {
  const normalized = categoryIdOrLabel.trim().toLowerCase();
  return categories.find(
    (item) =>
      item.id === normalized ||
      item.label.toLowerCase() === normalized ||
      item.id === categoryIdOrLabel,
  );
}

export function getCategoryKeyword(categoryIdOrLabel: string): string {
  const category = findCategory(categoryIdOrLabel);
  if (!category) {
    throw new Error(`Unknown category: ${categoryIdOrLabel}`);
  }
  return category.keyword;
}

export function getCategorySearchKeywords(categoryIdOrLabel: string): string[] {
  const category = findCategory(categoryIdOrLabel);
  if (!category) {
    throw new Error(`Unknown category: ${categoryIdOrLabel}`);
  }
  return category.searchKeywords?.length ? category.searchKeywords : [category.keyword];
}

export function getCategoryLabel(categoryIdOrLabel: string): string {
  const category = findCategory(categoryIdOrLabel);
  return category?.label ?? categoryIdOrLabel;
}

export function getCategoryMatchTerms(categoryIdOrLabel: string): string[] {
  const category = findCategory(categoryIdOrLabel);
  if (!category) {
    throw new Error(`Unknown category: ${categoryIdOrLabel}`);
  }
  return category.matchTerms;
}

export function getCategoryStrictRelevance(categoryIdOrLabel: string): boolean {
  const category = findCategory(categoryIdOrLabel);
  if (!category) {
    throw new Error(`Unknown category: ${categoryIdOrLabel}`);
  }
  return category.strictRelevance;
}
