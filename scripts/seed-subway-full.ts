/**
 * Replaces Subway's seeded menu and ingredient catalog with the complete
 * official U.S. Nutrition Information sheet (January 2026).
 *
 * Safe to run on a live DB: old Subway foods are deleted, which sets
 * diary_entries.food_id to NULL while their immutable nutrition snapshots
 * keep history intact.
 *
 * Run: pnpm tsx scripts/seed-subway-full.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";

import * as schema from "../src/lib/db/schema";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const db = drizzle(neon(url), { schema });

// [name, serving g, kcal, fat g, sat fat g, chol mg, sodium mg, carbs g, fiber g, sugar g, protein g]
type Row = [string, number, number, number, number, number, number, number, number, number, number];

const MENU: Record<string, Row[]> = {
  '6" Sandwiches': [
    ['6" Steak Philly', 192, 510, 25, 9, 85, 1320, 43, 2, 5, 28],
    ['6" Chipotle Philly', 198, 490, 22, 9, 90, 1440, 44, 2, 5, 30],
    ['6" Cheesy Garlic Steak', 199, 510, 23, 6, 70, 1190, 49, 3, 5, 26],
    ['6" Grilled Chicken', 247, 510, 24, 8, 85, 830, 43, 3, 5, 31],
    ['6" Chicken & Bacon Ranch', 262, 580, 29, 10, 105, 1230, 44, 3, 5, 35],
    ['6" Spicy Nacho Chicken', 203, 440, 17, 4, 65, 1280, 49, 3, 5, 24],
    ['6" Honey Mustard BBQ Chicken', 273, 510, 20, 8, 85, 1350, 53, 3, 13, 30],
    ['6" Sweet Onion Teriyaki Chicken', 256, 430, 11, 5, 70, 1250, 55, 4, 20, 29],
    ['6" B.M.T.', 240, 610, 36, 12, 80, 1500, 44, 2, 5, 27],
    ['6" Spicy Italian', 239, 680, 44, 15, 95, 1690, 44, 3, 5, 27],
    ['6" 5 Meat Italian', 303, 680, 37, 13, 110, 1940, 46, 3, 6, 40],
    ['6" Meatball Marinara', 239, 570, 28, 12, 60, 1370, 53, 4, 7, 27],
    ['6" Meatball Pepperoni', 268, 690, 38, 16, 85, 1860, 56, 4, 7, 33],
    ['6" Oven-Roasted Turkey', 233, 480, 23, 7, 55, 1150, 42, 3, 5, 26],
    ['6" Black Forest Ham', 233, 490, 23, 8, 60, 1190, 44, 2, 5, 25],
    ['6" Roast Beef', 247, 500, 23, 8, 65, 1120, 44, 2, 6, 31],
    ['6" Cold Cut Combo', 240, 530, 29, 9, 75, 1320, 43, 2, 5, 25],
    ['6" Tuna', 236, 570, 33, 9, 60, 950, 42, 2, 4, 27],
    ['6" Veggie Delite', 191, 320, 10, 5, 20, 600, 41, 4, 6, 17],
    ['6" All American Club', 242, 540, 28, 10, 75, 1520, 45, 3, 6, 27],
    ['6" Subway Club', 263, 500, 24, 8, 75, 1520, 43, 4, 8, 31],
    ['6" Big Hot Pastrami', 232, 550, 30, 11, 90, 2070, 44, 2, 5, 30],
    ['6" B.L.T.', 171, 480, 26, 7, 40, 800, 42, 2, 5, 18],
    ['6" Buffalo Chicken', 288, 510, 19, 7, 80, 1780, 55, 3, 7, 31],
    ['6" Oven-Roasted Turkey & Ham', 233, 480, 23, 7, 55, 1140, 41, 4, 6, 27],
    ['6" Pizza Sub', 177, 490, 25, 11, 60, 1340, 45, 2, 5, 22],
    ['6" Veggie Patty', 263, 470, 19, 6, 20, 1100, 58, 12, 9, 19],
    ['6" Grilled Chicken & Smashed Avocado', 311, 470, 19, 4, 80, 930, 44, 6, 8, 35],
    ['6" Grilled Chicken & Fresh Avocado', 304, 450, 16, 3, 80, 800, 44, 6, 7, 35],
    ['6" Ham & Turkey Stacker', 226, 290, 5, 1, 25, 1000, 42, 4, 6, 20],
    ['6" Turkey & Ranch Delite', 254, 380, 13, 3, 45, 1140, 41, 5, 7, 26],
    ['6" Seasoned Steak & Smashed Avocado', 297, 460, 16, 5, 85, 1170, 45, 6, 7, 35],
    ['6" Seasoned Steak & Fresh Avocado', 290, 430, 14, 4, 85, 1040, 45, 6, 7, 35],
    ["Kids' Mini Sub Veggie Delite", 108, 140, 2, 0, 0, 240, 27, 3, 4, 6],
    ["Kids' Mini Sub Black Forest Ham", 137, 180, 3, 1, 15, 480, 28, 3, 4, 11],
    ["Kids' Mini Sub Oven Roasted Turkey", 137, 170, 3, 0, 15, 470, 27, 3, 4, 12],
  ],
  Wraps: [
    ["Steak Philly Wrap", 295, 710, 35, 11, 140, 1970, 56, 3, 5, 46],
    ["Chipotle Philly Wrap", 300, 700, 32, 11, 145, 2090, 56, 3, 5, 47],
    ["Cheesy Garlic Steak Wrap", 302, 710, 33, 7, 125, 1840, 62, 3, 5, 43],
    ["Grilled Chicken Wrap", 349, 680, 31, 9, 135, 1240, 55, 3, 5, 48],
    ["Chicken & Bacon Ranch Wrap", 367, 830, 42, 14, 170, 1850, 56, 3, 7, 56],
    ["Spicy Nacho Chicken Wrap", 294, 610, 24, 5, 115, 1730, 59, 3, 6, 40],
    ["Honey Mustard BBQ Chicken Wrap", 363, 680, 27, 9, 135, 1800, 63, 4, 14, 46],
    ["Sweet Onion Teriyaki Chicken Wrap", 360, 620, 16, 6, 120, 1690, 76, 3, 27, 45],
    ["B.M.T. Wrap", 240, 610, 36, 12, 80, 1500, 44, 2, 5, 27],
    ["Spicy Italian Wrap", 318, 1010, 69, 24, 155, 2670, 57, 3, 6, 39],
    ["5 Meat Italian Wrap", 450, 1000, 56, 19, 195, 3230, 60, 3, 8, 66],
    ["Meatball Marinara Wrap", 397, 890, 49, 19, 95, 2140, 76, 7, 12, 40],
    ["Meatball Pepperoni Wrap", 433, 1050, 63, 24, 135, 2730, 77, 7, 12, 47],
    ["Oven-Roasted Turkey Wrap", 309, 610, 27, 8, 85, 1660, 53, 3, 6, 38],
    ["Black Forest Ham Wrap", 309, 630, 28, 8, 85, 1740, 57, 3, 7, 36],
    ["Roast Beef Wrap", 337, 660, 27, 8, 100, 1600, 57, 3, 8, 48],
    ["Cold Cut Combo Wrap", 323, 720, 40, 11, 125, 1990, 54, 3, 6, 35],
    ["Tuna Wrap", 330, 900, 59, 13, 100, 1310, 52, 3, 5, 41],
    ["Veggie Delite Wrap", 210, 400, 13, 5, 20, 690, 53, 3, 5, 17],
    ["All American Club Wrap", 333, 760, 39, 13, 120, 2220, 57, 3, 9, 44],
    ["Subway Club Wrap", 374, 690, 30, 9, 125, 2300, 58, 3, 9, 48],
    ["Big Hot Pastrami Wrap", 365, 890, 54, 17, 160, 3050, 56, 3, 7, 49],
    ["B.L.T. Wrap", 220, 710, 42, 12, 75, 1200, 53, 3, 7, 30],
    ["Turkey & Ham Wrap", 309, 620, 28, 8, 85, 1700, 55, 3, 7, 37],
    ["Pizza Sub Wrap", 232, 730, 42, 16, 100, 1980, 56, 3, 6, 30],
    ["Veggie Patty Wrap", 367, 720, 30, 7, 20, 1500, 87, 19, 10, 25],
  ],
  "Protein Pockets": [
    ["Baja Chicken Protein Pocket", 184, 330, 13, 5, 70, 750, 30, 2, 2, 24],
    ["Italian Trio Protein Pocket", 192, 480, 29, 10, 80, 1580, 32, 2, 2, 22],
    ["Peppercorn Ranch Chicken Protein Pocket", 190, 330, 13, 5, 70, 800, 30, 2, 2, 24],
    ["Turkey & Ham Protein Pocket", 193, 320, 11, 4, 50, 1260, 32, 2, 4, 21],
  ],
  Salads: [
    ["Steak Philly Salad", 409, 450, 35, 10, 95, 1080, 13, 4, 6, 24],
    ["Chipotle Philly Salad", 415, 400, 28, 10, 95, 1260, 15, 5, 7, 25],
    ["Cheesy Garlic Steak Salad", 434, 460, 32, 8, 80, 1180, 21, 5, 8, 23],
    ["Grilled Chicken Salad", 415, 440, 34, 9, 95, 590, 12, 4, 6, 26],
    ["Chicken & Bacon Ranch Salad", 430, 490, 36, 11, 110, 1020, 14, 5, 7, 30],
    ["Spicy Nacho Chicken Salad", 420, 320, 19, 4, 65, 1220, 20, 5, 8, 20],
    ["Honey Mustard BBQ Chicken Salad", 454, 420, 24, 8, 90, 1280, 31, 5, 22, 25],
    ["Sweet Onion Teriyaki Chicken Salad", 423, 300, 10, 5, 70, 1100, 33, 4, 25, 23],
    ["B.M.T. Salad", 407, 540, 46, 14, 90, 1250, 13, 4, 6, 22],
    ["Spicy Italian Salad", 407, 610, 54, 17, 100, 1450, 13, 4, 5, 22],
    ["5 Meat Italian Salad", 471, 610, 47, 14, 120, 1690, 14, 4, 7, 35],
    ["Meatball Marinara Salad with MVP Parmesan Vinaigrette", 484, 530, 39, 14, 60, 1360, 25, 7, 11, 23],
    ["Meatball Pepperoni Salad with MVP Parmesan Vinaigrette", 502, 610, 47, 16, 80, 1650, 26, 7, 11, 26],
    ["Oven-Roasted Turkey Salad", 400, 410, 33, 9, 65, 910, 11, 4, 5, 21],
    ["Black Forest Ham Salad", 400, 420, 33, 9, 65, 950, 13, 4, 6, 20],
    ["Roast Beef Salad", 415, 440, 33, 9, 75, 880, 13, 4, 6, 26],
    ["Cold Cut Combo Salad", 408, 470, 39, 10, 85, 1080, 11, 4, 5, 20],
    ["Tuna Salad", 390, 410, 32, 8, 60, 640, 10, 4, 5, 22],
    ["Veggie Delite Salad", 316, 150, 9, 5, 20, 320, 10, 4, 5, 10],
    ["All American Club Salad", 410, 480, 39, 11, 80, 1270, 13, 4, 7, 22],
    ["Subway Club Salad", 430, 440, 34, 9, 85, 1310, 14, 4, 7, 24],
    ["Big Hot Pastrami Salad", 463, 410, 30, 11, 90, 1930, 15, 5, 7, 26],
    ["B.L.T. Salad", 345, 420, 36, 8, 50, 550, 11, 4, 6, 13],
    ["Turkey & Ham Salad", 400, 420, 33, 9, 65, 930, 12, 4, 6, 21],
    ["Pizza Sub Salad", 380, 330, 24, 10, 60, 1030, 15, 5, 7, 17],
    ["Veggie Patty Salad", 395, 300, 17, 5, 20, 820, 28, 12, 8, 13],
  ],
  "Protein Bowls": [
    ["Steak Philly Protein Bowl", 403, 630, 46, 16, 170, 1950, 14, 3, 7, 43],
    ["Chipotle Philly Protein Bowl", 415, 600, 41, 17, 175, 2180, 16, 4, 7, 46],
    ["Cheesy Garlic Steak Protein Bowl", 417, 630, 42, 10, 140, 1670, 27, 4, 8, 39],
    ["Grilled Chicken Protein Bowl", 415, 620, 44, 15, 170, 960, 12, 3, 6, 48],
    ["Chicken & Bacon Ranch Protein Bowl", 445, 760, 55, 19, 205, 1750, 14, 4, 7, 55],
    ["Spicy Nacho Chicken Protein Bowl", 425, 510, 30, 7, 125, 1870, 26, 5, 9, 35],
    ["Honey Mustard BBQ Chicken Protein Bowl", 466, 620, 36, 14, 170, 2010, 31, 4, 22, 45],
    ["Sweet Onion Teriyaki Chicken Protein Bowl", 432, 470, 18, 10, 140, 1860, 41, 3, 33, 42],
    ["B.M.T. Protein Bowl", 401, 820, 68, 23, 165, 2290, 14, 3, 6, 40],
    ["Spicy Italian Protein Bowl", 396, 960, 84, 29, 185, 2610, 14, 3, 5, 39],
    ["5 Meat Italian Protein Bowl", 528, 960, 70, 24, 225, 3170, 17, 3, 8, 66],
    ["Meatball Marinara Protein Bowl with MVP Parmesan Vinaigrette", 553, 880, 65, 25, 120, 2340, 37, 8, 14, 42],
    ["Meatball Pepperoni Protein Bowl with MVP Parmesan Vinaigrette", 589, 1040, 79, 31, 160, 2930, 38, 8, 14, 48],
    ["Oven-Roasted Turkey Protein Bowl", 386, 560, 42, 13, 115, 1600, 10, 3, 5, 38],
    ["Black Forest Ham Protein Bowl", 386, 580, 43, 14, 115, 1680, 14, 3, 7, 36],
    ["Roast Beef Protein Bowl", 415, 610, 42, 14, 130, 1540, 14, 3, 7, 48],
    ["Cold Cut Combo Protein Bowl", 401, 670, 55, 16, 155, 1930, 11, 3, 5, 35],
    ["Tuna Protein Bowl", 394, 750, 62, 17, 120, 1190, 9, 3, 4, 41],
    ["All American Club Protein Bowl", 405, 690, 53, 18, 150, 2330, 15, 3, 9, 40],
    ["Subway Club Protein Bowl", 418, 410, 21, 11, 135, 2280, 16, 3, 9, 44],
    ["Big Hot Pastrami Protein Bowl", 512, 740, 57, 21, 180, 3430, 17, 4, 9, 46],
    ["B.L.T. Protein Bowl", 276, 560, 49, 13, 85, 890, 10, 3, 7, 22],
    ["Turkey & Ham Protein Bowl", 386, 570, 42, 14, 115, 1640, 12, 3, 6, 37],
    ["Pizza Sub Protein Bowl", 372, 600, 46, 20, 120, 1980, 18, 4, 8, 31],
    ["Veggie Patty Protein Bowl", 404, 540, 33, 10, 45, 1550, 44, 19, 10, 22],
  ],
  Breakfast: [
    ['6" Bacon, Egg & Cheese', 193, 550, 30, 11, 280, 1200, 43, 2, 4, 26],
    ['6" Black Forest Ham, Egg & Cheese', 207, 500, 25, 9, 275, 1270, 43, 2, 4, 26],
    ['6" Egg & Cheese', 178, 470, 24, 8, 265, 1020, 42, 2, 4, 21],
    ['6" Steak, Egg & Cheese', 221, 540, 26, 10, 295, 1300, 43, 2, 4, 31],
    ["Bacon, Egg & Cheese Wrap", 325, 900, 56, 16, 540, 1790, 57, 2, 5, 42],
    ["Black Forest Ham, Egg & Cheese Wrap", 351, 810, 46, 12, 530, 1930, 58, 2, 5, 42],
    ["Egg & Cheese Wrap", 295, 740, 44, 12, 505, 1440, 55, 2, 3, 32],
    ["Steak, Egg & Cheese Wrap", 366, 860, 48, 14, 560, 1890, 57, 2, 4, 48],
  ],
  'Pizza & Sliders': [
    ['8" Cheese Pizza', 293, 700, 22, 9, 50, 1370, 95, 4, 8, 29],
    ['8" Bacon Pizza', 308, 780, 28, 12, 65, 1540, 96, 4, 9, 34],
    ['8" Meatball Pizza', 330, 810, 31, 13, 70, 1590, 98, 5, 8, 35],
    ['8" Pepperoni Pizza', 311, 780, 29, 12, 70, 1660, 96, 5, 8, 33],
    ["Ham & Jack Slider", 71, 160, 4, 2, 20, 550, 21, 0, 2, 10],
    ["Italian Spice Slider", 72, 250, 15, 5, 30, 740, 21, 0, 2, 9],
    ["Little Cheesesteak Slider", 71, 180, 7, 3, 20, 450, 21, 1, 2, 8],
    ["Turkey Slider", 88, 230, 12, 4, 30, 690, 20, 1, 2, 12],
  ],
  "Cookies & Sides": [
    ["Chocolate Chip Cookie", 45, 210, 10, 5, 10, 120, 30, 0, 18, 2],
    ["Double Chocolate Cookie", 45, 210, 9, 5, 15, 125, 29, 1, 20, 2],
    ["Oatmeal Raisin Cookie", 45, 200, 8, 4, 15, 110, 30, 1, 16, 3],
    ["Raspberry Cheesecake Cookie", 45, 210, 9, 5, 15, 115, 29, 0, 16, 2],
    ["White Chip Macadamia Nut Cookie", 45, 210, 10, 5, 15, 125, 28, 0, 17, 2],
    ["Applesauce", 90, 70, 0, 0, 0, 0, 16, 3, 13, 0],
    ["Hash Browns", 108, 190, 9, 3, 0, 600, 24, 3, 1, 3],
    ["Footlong Chocolate Chip Cookie", 285, 1330, 61, 32, 95, 690, 181, 8, 101, 14],
  ],
  Soups: [
    ["Broccoli Cheddar Soup (8 oz)", 227, 200, 13, 8, 45, 960, 16, 0, 7, 9],
    ["Chicken Noodle Soup (8 oz)", 227, 70, 3, 1, 15, 1160, 6, 0, 1, 7],
    ["Loaded Baked Potato with Bacon Soup (8 oz)", 227, 200, 14, 7, 45, 910, 17, 1, 4, 9],
  ],
};

// Builder catalog. Extra last element marks default-selected.
type IngredientRow = [...Row, boolean?];

const INGREDIENTS: Record<string, IngredientRow[]> = {
  Bread: [
    ['6" Artisan Italian Bread', 71, 210, 2, 1, 0, 380, 39, 1, 3, 8, true],
    ['6" Hearty Multigrain Bread', 71, 200, 3, 0, 0, 350, 36, 3, 4, 9],
    ['6" Italian Herbs & Cheese Bread', 77, 230, 5, 2, 5, 500, 40, 1, 4, 9],
    ['6" Jalapeño Cheddar Bread', 82, 240, 5, 2, 5, 500, 39, 2, 3, 9],
    ['6" Artisan Flatbread', 78, 220, 4, 1, 0, 360, 40, 1, 2, 7],
    ['12" Wrap', 102, 300, 8, 1, 0, 580, 50, 2, 2, 8],
    ['9" Wrap (Pocket)', 52, 150, 3, 1, 0, 340, 26, 0, 0, 4],
    ["Mini Artisan Italian Bread", 47, 140, 2, 1, 0, 250, 26, 0, 2, 5],
    ["Mini Hearty Multigrain Bread", 47, 130, 2, 0, 0, 230, 24, 2, 2, 6],
    ["Mini Italian Herbs & Cheese Bread", 51, 160, 3.5, 1.5, 5, 340, 27, 1, 3, 6],
  ],
  Protein: [
    ["All-American Club Meats (Ham, Turkey, Bacon)", 72, 140, 8, 3, 45, 650, 2, 0, 1, 15],
    ["Bacon (2 strips)", 15, 80, 6, 3, 15, 170, 1, 0, 1, 5],
    ["Black Forest Ham", 57, 70, 2, 1, 30, 490, 2, 0, 1, 10],
    ["Cold Cut Combo Meats", 64, 110, 8, 1, 45, 620, 1, 0, 1, 9],
    ["Egg Patty", 85, 180, 15, 4, 240, 220, 2, 0, 0, 10],
    ["Genoa Salami (3 slices)", 18, 70, 6, 3, 20, 260, 1, 0, 0, 3],
    ["Grilled Chicken", 71, 80, 2, 2, 50, 210, 1, 0, 1, 16],
    ["Grilled Chicken, Sweet Onion Teriyaki Glazed", 85, 110, 2, 1, 50, 350, 9, 0, 8, 16],
    ["Meatballs", 139, 250, 18, 7, 35, 720, 13, 2, 5, 12],
    ["Oven-Roasted Turkey", 57, 60, 2, 1, 25, 450, 0, 0, 0, 11, true],
    ["Pastrami", 57, 130, 10, 3, 35, 470, 1, 0, 1, 9],
    ["Pepperoni (3 slices)", 18, 80, 7, 3, 20, 290, 1, 0, 0, 3],
    ["Roast Beef", 71, 80, 2, 1, 35, 420, 2, 0, 2, 15],
    ["Rotisserie-Style Chicken", 71, 90, 4, 1, 50, 400, 0, 0, 0, 15],
    ["Steak (no cheese)", 71, 110, 5, 2, 55, 450, 2, 0, 1, 17],
    ["Subway Club Meats (Turkey, Ham, Roast Beef)", 92, 110, 3, 1, 45, 690, 3, 0, 2, 17],
    ["Tuna", 74, 250, 23, 2, 40, 310, 0, 0, 0, 12],
    ["Veggie Patty", 85, 170, 9, 1, 0, 320, 17, 8, 2, 6],
  ],
  Cheese: [
    ["American Cheese", 23, 80, 7, 5, 20, 420, 1, 0, 1, 4, true],
    ["Monterey Cheddar, Shredded", 28, 110, 9, 5, 25, 170, 1, 0, 0, 7],
    ["Parmesan, Grated", 1, 5, 0, 0, 0, 25, 0, 0, 0, 0],
    ["Pepper Jack Cheese", 28, 100, 8, 5, 25, 480, 1, 0, 0, 5],
    ["Provolone", 25, 90, 7, 4, 20, 220, 1, 0, 0, 6],
  ],
  Veggies: [
    ["Avocado, Sliced", 28, 45, 4, 1, 0, 0, 2, 2, 0, 1],
    ["Avocado, Smashed", 35, 70, 6, 1, 0, 130, 3, 2, 0, 1],
    ["Banana Peppers (3 rings)", 4, 0, 0, 0, 0, 65, 0, 0, 0, 0],
    ["Cucumbers (3 slices)", 14, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    ["Green Chiles", 14, 5, 0, 0, 0, 95, 1, 0, 0, 0],
    ["Green Peppers (3 strips)", 7, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ["Jalapeno Peppers (3 rings)", 4, 0, 0, 0, 0, 70, 0, 0, 0, 0],
    ["Lettuce", 21, 0, 0, 0, 0, 0, 0, 0, 0, 0, true],
    ["Olives, Black (3 rings)", 3, 0, 0, 0, 0, 25, 0, 0, 0, 0],
    ["Onions", 7, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    ["Pickles, Crinkle (3 chips)", 12, 0, 0, 0, 0, 160, 0, 0, 0, 0],
    ["Spinach, Baby", 7, 0, 0, 0, 0, 5, 0, 0, 0, 0],
    ["Tomatoes (3 wheels)", 35, 5, 0, 0, 0, 0, 1, 0, 1, 0, true],
  ],
  Sauce: [
    ["Baja Chipotle", 14, 70, 7, 1, 5, 125, 1, 0, 1, 0],
    ["BBQ Sauce", 14, 25, 0, 0, 0, 115, 6, 0, 5, 0],
    ["Cheddar Cheese Sauce", 18, 30, 3, 2, 5, 150, 1, 0, 1, 1],
    ["Creamy Sriracha", 14, 40, 4, 1, 5, 240, 2, 0, 1, 0],
    ["Buffalo Sauce", 14, 0, 0, 0, 0, 390, 0, 0, 0, 0],
    ["Giardiniera", 28, 80, 9, 2, 0, 340, 1, 0, 1, 0],
    ["Honey Mustard", 14, 60, 5, 1, 5, 125, 3, 0, 3, 0],
    ["Hot Honey Sauce", 14, 30, 0, 0, 0, 120, 8, 0, 8, 0],
    ["Mayonnaise", 14, 100, 11, 2, 10, 65, 0, 0, 0, 0],
    ["Mustard, Yellow", 14, 10, 1, 0, 0, 170, 1, 0, 0, 0],
    ["Olive Oil Blend", 5, 45, 5, 0, 0, 0, 0, 0, 0, 0],
    ["Olive Oil Blend & Vinegar", 9, 45, 5, 0, 0, 0, 0, 0, 0, 0],
    ["MVP Parmesan Vinaigrette", 14, 60, 6, 1, 0, 140, 1, 0, 1, 0],
    ["Peppercorn Ranch", 14, 80, 8, 2, 5, 100, 1, 0, 1, 0],
    ["Red Wine Vinegar", 4, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ["Roasted Garlic Aioli", 14, 80, 9, 2, 5, 150, 1, 0, 1, 0],
    ["Subkrunch", 11, 70, 5, 0, 0, 45, 6, 0, 0, 1],
    ["Sweet Onion Teriyaki", 14, 30, 0, 0, 0, 130, 7, 0, 6, 0],
  ],
  Seasonings: [
    ["Black Pepper", 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ["Oregano", 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ["Salt", 1, 0, 0, 0, 0, 160, 0, 0, 0, 0],
  ],
};

function foodValues(row: Row | IngredientRow, unit: string) {
  const [name, servingG, calories, fat, satFat, chol, sodium, carbs, fiber, sugar, protein] = row;
  return {
    name,
    brandName: "Subway",
    sourceType: "official_store" as const,
    servingSizeValue: servingG,
    servingSizeUnit: unit,
    calories,
    proteinG: protein,
    carbsG: carbs,
    fatG: fat,
    fiberG: fiber,
    sugarG: sugar,
    satFatG: satFat,
    sodiumMg: sodium,
    cholesterolMg: chol,
    isVerified: true,
  };
}

async function main() {
  const [store] = await db
    .select()
    .from(schema.stores)
    .where(eq(schema.stores.slug, "subway"))
    .limit(1);
  if (!store) {
    console.error("Subway store not found — run pnpm db:seed first");
    process.exit(1);
  }

  // Remove the old catalog. Deleting the foods cascades to menu/ingredient
  // rows; diary entries keep their snapshots (food_id becomes NULL).
  const oldMenu = await db
    .select({ foodId: schema.storeMenuItems.foodId })
    .from(schema.storeMenuItems)
    .where(eq(schema.storeMenuItems.storeId, store.id));
  const oldIngredients = await db
    .select({ foodId: schema.storeIngredients.foodId })
    .from(schema.storeIngredients)
    .where(eq(schema.storeIngredients.storeId, store.id));
  const oldFoodIds = [
    ...new Set([...oldMenu, ...oldIngredients].map((row) => row.foodId)),
  ];
  if (oldFoodIds.length > 0) {
    await db.delete(schema.foods).where(inArray(schema.foods.id, oldFoodIds));
  }
  console.log(`Removed ${oldFoodIds.length} old Subway foods`);

  let menuCount = 0;
  for (const [category, rows] of Object.entries(MENU)) {
    let order = 0;
    for (const row of rows) {
      const [food] = await db
        .insert(schema.foods)
        .values(foodValues(row, "item"))
        .returning({ id: schema.foods.id });
      await db.insert(schema.storeMenuItems).values({
        storeId: store.id,
        foodId: food.id,
        isDefaultVerified: true,
        menuCategory: category,
        displayOrder: order++,
      });
      menuCount++;
    }
    console.log(`Menu: ${category} (${rows.length})`);
  }

  let ingredientCount = 0;
  for (const [group, rows] of Object.entries(INGREDIENTS)) {
    for (const row of rows) {
      const [food] = await db
        .insert(schema.foods)
        .values(foodValues(row, "portion"))
        .returning({ id: schema.foods.id });
      await db.insert(schema.storeIngredients).values({
        storeId: store.id,
        foodId: food.id,
        ingredientGroup: group,
        isDefaultSelected: row[11] === true,
      });
      ingredientCount++;
    }
    console.log(`Ingredients: ${group} (${rows.length})`);
  }

  console.log(`Done: ${menuCount} menu items, ${ingredientCount} ingredients`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
