import { spawnSync } from "node:child_process"

import { loadEnv, requireEnv } from "./env.mjs"

loadEnv()
requireEnv(["DATABASE_URL"])

const products = [
  {
    name: "Parle-G Biscuit",
    sku: "PG-001",
    unit_name: "piece",
    loose_sale_price: 10,
    loose_cost_price: 8,
    has_box: true,
    box_units: 24,
    box_sale_price: 230,
    box_cost_price: 190,
    opening_stock: 240,
    reorder_level: 48,
  },
  {
    name: "Good Day Cashew",
    sku: "GD-002",
    unit_name: "piece",
    loose_sale_price: 20,
    loose_cost_price: 16,
    has_box: true,
    box_units: 24,
    box_sale_price: 455,
    box_cost_price: 380,
    opening_stock: 144,
    reorder_level: 36,
  },
  {
    name: "Amul Taaza Milk 500ml",
    sku: "AM-500",
    unit_name: "packet",
    loose_sale_price: 28,
    loose_cost_price: 26,
    has_box: false,
    opening_stock: 60,
    reorder_level: 20,
  },
  {
    name: "Tata Salt 1kg",
    sku: "TS-1KG",
    unit_name: "bag",
    loose_sale_price: 28,
    loose_cost_price: 24,
    has_box: true,
    box_units: 20,
    box_sale_price: 540,
    box_cost_price: 470,
    opening_stock: 100,
    reorder_level: 30,
  },
  {
    name: "Aashirvaad Atta 5kg",
    sku: "AA-5KG",
    unit_name: "bag",
    loose_sale_price: 235,
    loose_cost_price: 215,
    has_box: false,
    opening_stock: 28,
    reorder_level: 10,
  },
  {
    name: "Fortune Sunflower Oil 1L",
    sku: "FSO-1L",
    unit_name: "bottle",
    loose_sale_price: 150,
    loose_cost_price: 137,
    has_box: true,
    box_units: 15,
    box_sale_price: 2190,
    box_cost_price: 2025,
    opening_stock: 45,
    reorder_level: 15,
  },
  {
    name: "Maggi Noodles 70g",
    sku: "MG-70",
    unit_name: "packet",
    loose_sale_price: 15,
    loose_cost_price: 12,
    has_box: true,
    box_units: 96,
    box_sale_price: 1380,
    box_cost_price: 1120,
    opening_stock: 288,
    reorder_level: 96,
  },
  {
    name: "Red Label Tea 250g",
    sku: "RL-250",
    unit_name: "packet",
    loose_sale_price: 160,
    loose_cost_price: 145,
    has_box: true,
    box_units: 24,
    box_sale_price: 3720,
    box_cost_price: 3400,
    opening_stock: 48,
    reorder_level: 12,
  },
  {
    name: "Clinic Plus Shampoo 80ml",
    sku: "CP-80",
    unit_name: "bottle",
    loose_sale_price: 75,
    loose_cost_price: 65,
    has_box: true,
    box_units: 48,
    box_sale_price: 3450,
    box_cost_price: 3000,
    opening_stock: 96,
    reorder_level: 24,
  },
  {
    name: "Surf Excel Bar 250g",
    sku: "SEB-250",
    unit_name: "bar",
    loose_sale_price: 35,
    loose_cost_price: 30,
    has_box: true,
    box_units: 60,
    box_sale_price: 1980,
    box_cost_price: 1710,
    opening_stock: 180,
    reorder_level: 60,
  },
  {
    name: "Colgate Strong Teeth 100g",
    sku: "CG-100",
    unit_name: "tube",
    loose_sale_price: 68,
    loose_cost_price: 58,
    has_box: true,
    box_units: 72,
    box_sale_price: 4650,
    box_cost_price: 3980,
    opening_stock: 144,
    reorder_level: 36,
  },
  {
    name: "Dairy Milk 13g",
    sku: "DM-13",
    unit_name: "piece",
    loose_sale_price: 10,
    loose_cost_price: 8.5,
    has_box: true,
    box_units: 60,
    box_sale_price: 580,
    box_cost_price: 500,
    opening_stock: 180,
    reorder_level: 60,
  },
]

function sqlQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

const countResult = spawnSync(
  "psql",
  [
    process.env.DATABASE_URL,
    "-v",
    "ON_ERROR_STOP=1",
    "-Atc",
    "select count(*) from public.products;",
  ],
  { encoding: "utf8" }
)

if (countResult.status !== 0) {
  throw new Error("Failed to check product count")
}

const existingCount = Number.parseInt(countResult.stdout.trim(), 10)

if (existingCount >= 10) {
  console.log(`Products already seeded (${existingCount}).`)
  process.exit(0)
}

const sql = products
  .map((product) => {
    return `select public.create_product(${sqlQuote(`starter-product-${product.sku}`)}, ${sqlQuote(JSON.stringify(product))}::jsonb);`
  })
  .join("\n")

const result = spawnSync(
  "psql",
  [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql],
  { stdio: "inherit" }
)

if (result.status !== 0) {
  throw new Error("Failed to seed products")
}

console.log(`Seeded ${products.length} starter products.`)
