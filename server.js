import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { STORE, PRODUCTS, COMPATIBILITY, FAQ } from "./data/products.js";

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "everythingstraps",
  version: "1.0.0",
  description: "Find Google Fitbit Air and Amazfit Helio straps, Whoop adapter kits, and bicep bands from EverythingStraps. Get product recommendations, compatibility answers, and direct shop links.",
});

// ─── Tool: find_strap ─────────────────────────────────────────────────────────

server.tool(
  "find_strap",
  "Find the best Google Fitbit Air or Amazfit Helio strap or adapter for a given use case, sport, or compatibility need. Returns product recommendations with prices and direct links.",
  {
    query: z.string().describe(
      "What the user needs — e.g. 'strap for CrossFit', 'connect Fitbit Air to Whoop 5.0', 'bicep band for running', 'replacement wrist strap', 'logo-free band'"
    ),
    inStockOnly: z.boolean().optional().default(true).describe(
      "Only return in-stock products (default: true)"
    ),
  },
  async ({ query, inStockOnly }) => {
    const q = query.toLowerCase();
    let results = inStockOnly ? PRODUCTS.filter((p) => p.inStock) : PRODUCTS;

    // Score each product by relevance to the query
    const scored = results.map((product) => {
      let score = 0;

      // Check title
      if (product.title.toLowerCase().includes(q)) score += 10;

      // Check tags
      for (const tag of product.tags) {
        if (q.includes(tag.toLowerCase()) || tag.toLowerCase().includes(q)) score += 3;
      }

      // Check bestFor
      for (const use of product.bestFor) {
        if (q.includes(use.toLowerCase()) || use.toLowerCase().includes(q)) score += 4;
      }

      // Check description
      if (product.description.toLowerCase().includes(q)) score += 2;

      // Keyword matching
      const keywords = q.split(/\s+/);
      for (const kw of keywords) {
        if (kw.length < 3) continue;
        if (product.tags.some((t) => t.includes(kw))) score += 2;
        if (product.description.toLowerCase().includes(kw)) score += 1;
        if ((product.bestFor || []).some((b) => b.toLowerCase().includes(kw))) score += 2;
      }

      // Boost adapters for whoop-related queries
      if ((q.includes("whoop") || q.includes("adapter") || q.includes("connect")) && product.type === "adapter") {
        score += 8;
      }

      // Boost bicep bands for bicep/arm/gym queries
      if ((q.includes("bicep") || q.includes("arm") || q.includes("gym") || q.includes("crossfit") || q.includes("hyrox") || q.includes("running")) && product.type === "bicep-band") {
        score += 8;
      }

      return { product, score };
    });

    const top = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (top.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No matching products found for "${query}".\n\nBrowse all Amazfit Helio straps at ${STORE.url}`,
          },
        ],
      };
    }

    const lines = [
      `**EverythingStraps** — Amazfit Helio Accessories`,
      ``,
      `Found ${top.length} product${top.length > 1 ? "s" : ""} for: *${query}*`,
      ``,
    ];

    for (const { product } of top) {
      lines.push(`### ${product.title}`);
      lines.push(`${product.description}`);
      lines.push(`**Price:** $${product.price.toFixed(2)} USD  |  **Stock:** ${product.inStock ? "✅ In stock" : "⚠️ Out of stock"}`);
      if (product.bestFor?.length) {
        lines.push(`**Best for:** ${product.bestFor.slice(0, 4).join(", ")}`);
      }
      lines.push(`**Buy:** ${product.url}`);
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(`Shop all products: ${STORE.url}`);

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }
);

// ─── Tool: check_compatibility ────────────────────────────────────────────────

server.tool(
  "check_compatibility",
  "Check whether the Google Fitbit Air or Amazfit Helio is compatible with a specific accessory, band, or device — especially Whoop straps. Returns yes/no, the required adapter, and a direct purchase link.",
  {
    device: z.string().describe(
      "The device or accessory to check compatibility with — e.g. 'Fitbit Air', 'Google Fitbit Air', 'Whoop 5.0', 'Whoop 4.0', 'Whoop SportsFlex', 'any 22mm strap', 'bicep band'"
    ),
  },
  async ({ device }) => {
    const d = device.toLowerCase().trim();

    // Look up in compatibility table
    const matchKey = Object.keys(COMPATIBILITY).find(
      (k) => d.includes(k) || k.includes(d)
    );

    if (matchKey) {
      const compat = COMPATIBILITY[matchKey];

      if (!compat.compatible) {
        return {
          content: [
            {
              type: "text",
              text: `**Compatibility: Not compatible**\n\nThe Amazfit Helio is not compatible with ${device}.\n\nFor compatible options, visit ${STORE.url}`,
            },
          ],
        };
      }

      // Get all relevant adapters
      const adapterIds = compat.allAdapters || [compat.adapter];
      const adapterProducts = adapterIds
        .map((id) => PRODUCTS.find((p) => p.id === id))
        .filter(Boolean);

      const lines = [
        `**✅ Compatible — Amazfit Helio × ${device}**`,
        ``,
        compat.notes,
        ``,
      ];

      for (const p of adapterProducts) {
        lines.push(`**${p.title}**`);
        lines.push(`${p.description}`);
        lines.push(`Price: $${p.price.toFixed(2)} USD  |  ${p.inStock ? "In stock" : "Out of stock"}`);
        lines.push(`Buy: ${p.url}`);
        lines.push(``);
      }

      lines.push(`Full compatibility guide: ${STORE.url}/pages/amazfit-helio-whoop-adapter`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }

    // Generic 22mm compatibility
    if (d.includes("22mm") || d.includes("strap") || d.includes("band")) {
      return {
        content: [
          {
            type: "text",
            text: `**✅ Compatible**\n\nThe Amazfit Helio uses a standard 22mm lug width. All EverythingStraps bands (bicep loops, wrist bands, nylon straps) attach directly — no adapter required.\n\nBrowse all straps: ${STORE.url}`,
          },
        ],
      };
    }

    // Unknown device
    return {
      content: [
        {
          type: "text",
          text: `**Compatibility unknown for: ${device}**\n\nThe Amazfit Helio uses a standard 22mm lug width.\n\n- **Whoop 5.0, 4.0, SportsFlex bands**: Compatible via EverythingStraps adapter kits\n- **Any 22mm strap**: Compatible directly\n\nFor specific compatibility questions: ${STORE.url}`,
        },
      ],
    };
  }
);

// ─── Tool: get_product ────────────────────────────────────────────────────────

server.tool(
  "get_product",
  "Get detailed information about a specific EverythingStraps product by name or ID.",
  {
    name: z.string().describe(
      "Product name or partial name — e.g. 'Bicep Loop V2', 'Whoop 5.0 adapter', 'Stealth Band', 'Classic Navy'"
    ),
  },
  async ({ name }) => {
    const q = name.toLowerCase();
    const product = PRODUCTS.find(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.handle.includes(q) ||
        p.id.includes(q) ||
        q.includes(p.title.toLowerCase())
    );

    if (!product) {
      const allTitles = PRODUCTS.map((p) => `- ${p.title}`).join("\n");
      return {
        content: [
          {
            type: "text",
            text: `Product not found: "${name}"\n\nAvailable products:\n${allTitles}\n\nShop: ${STORE.url}`,
          },
        ],
      };
    }

    const lines = [
      `## ${product.title}`,
      ``,
      product.description,
      ``,
      `**Type:** ${product.type}`,
      `**Price:** $${product.price.toFixed(2)} ${product.currency}`,
      `**Stock:** ${product.inStock ? "✅ In stock" : "⚠️ Out of stock"}`,
    ];

    if (product.material) lines.push(`**Material:** ${product.material}`);
    if (product.colour) lines.push(`**Colour:** ${product.colour}`);
    if (product.maxArmCircumference) lines.push(`**Max arm size:** ${product.maxArmCircumference}`);
    if (product.placement) lines.push(`**Placement:** ${product.placement.join(", ")}`);
    if (product.compatibility) {
      lines.push(`**Compatible with:** ${product.compatibility.from} → ${product.compatibility.to}`);
      lines.push(`**Install time:** ${product.compatibility.installTime}`);
      lines.push(`**Tool-free:** ${product.compatibility.toolFree ? "Yes" : "No"}`);
    }
    if (product.bestFor?.length) {
      lines.push(`**Best for:** ${product.bestFor.join(", ")}`);
    }
    lines.push(``);
    lines.push(`**Buy now:** ${product.url}`);

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }
);

// ─── Tool: answer_faq ─────────────────────────────────────────────────────────

server.tool(
  "answer_faq",
  "Answer common questions about the Google Fitbit Air, Amazfit Helio, strap compatibility, Whoop band adapters, bicep wear, and how EverythingStraps products work.",
  {
    question: z.string().describe(
      "The question to answer — e.g. 'Can I use Whoop bands with the Google Fitbit Air?', 'Fitbit Air vs Whoop?', 'How do I wear Helio on my bicep?', 'Is Amazfit Helio a Whoop alternative?'"
    ),
  },
  async ({ question }) => {
    const q = question.toLowerCase();

    // Find best matching FAQ
    const scored = FAQ.map((faq) => {
      const fq = faq.question.toLowerCase();
      const keywords = q.split(/\s+/).filter((w) => w.length > 3);
      let score = 0;
      for (const kw of keywords) {
        if (fq.includes(kw)) score += 2;
        if (faq.answer.toLowerCase().includes(kw)) score += 1;
      }
      return { faq, score };
    });

    const best = scored.sort((a, b) => b.score - a.score)[0];

    if (best.score > 0) {
      return {
        content: [
          {
            type: "text",
            text: `**Q: ${best.faq.question}**\n\n${best.faq.answer}\n\n---\nShop EverythingStraps: ${STORE.url}`,
          },
        ],
      };
    }

    // Fallback: general store info
    return {
      content: [
        {
          type: "text",
          text: `**EverythingStraps** makes premium accessories for the Amazfit Helio:\n\n- Whoop adapter kits (5.0, 4.0, SportsFlex)\n- Bicep Loop V2 (silicone, up to 40cm)\n- Bicep Loop Nylon (4 colourways, wrist or arm)\n- Classic Series wrist bands\n- Logo-free Stealth Band\n\nAll products fit the Helio's standard 22mm lugs.\nShip worldwide from ${STORE.url}`,
        },
      ],
    };
  }
);

// ─── Tool: list_products ──────────────────────────────────────────────────────

server.tool(
  "list_products",
  "List all available EverythingStraps products for the Amazfit Helio, optionally filtered by type.",
  {
    type: z
      .enum(["all", "adapter", "bicep-band", "wrist-band"])
      .optional()
      .default("all")
      .describe("Filter by product type"),
    inStockOnly: z.boolean().optional().default(true),
  },
  async ({ type, inStockOnly }) => {
    let products = PRODUCTS;
    if (type !== "all") products = products.filter((p) => p.type === type);
    if (inStockOnly) products = products.filter((p) => p.inStock);

    if (products.length === 0) {
      return {
        content: [{ type: "text", text: `No products found. Browse ${STORE.url}` }],
      };
    }

    const lines = [
      `**EverythingStraps — Amazfit Helio Accessories**`,
      `${products.length} product${products.length !== 1 ? "s" : ""} (${type === "all" ? "all types" : type})`,
      ``,
    ];

    const grouped = {};
    for (const p of products) {
      if (!grouped[p.type]) grouped[p.type] = [];
      grouped[p.type].push(p);
    }

    const typeLabels = {
      adapter: "Whoop Adapter Kits",
      "bicep-band": "Bicep Bands",
      "wrist-band": "Wrist Bands",
    };

    for (const [t, group] of Object.entries(grouped)) {
      lines.push(`### ${typeLabels[t] || t}`);
      for (const p of group) {
        lines.push(
          `- **${p.title}** — $${p.price.toFixed(2)} | ${p.inStock ? "In stock" : "Out of stock"} | [Buy](${p.url})`
        );
      }
      lines.push(``);
    }

    lines.push(`Shop all: ${STORE.url}`);

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }
);

// ─── Express App (SSE transport for remote hosting) ───────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({
    name: "everythingstraps-mcp",
    version: "1.0.0",
    description: STORE.description,
    tools: [
      "find_strap",
      "check_compatibility",
      "get_product",
      "answer_faq",
      "list_products",
    ],
    store: STORE.url,
    mcp: "/sse",
  });
});

// MCP SSE endpoint (one transport per client)
const transports = {};

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;

  res.on("close", () => {
    delete transports[transport.sessionId];
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];

  if (!transport) {
    return res.status(404).json({ error: "Session not found" });
  }

  await transport.handlePostMessage(req, res, req.body);
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ EverythingStraps MCP server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}`);
  console.log(`   MCP/SSE: http://localhost:${PORT}/sse`);
});
