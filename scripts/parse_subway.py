#!/usr/bin/env python3
"""Parse the official Subway U.S. Nutrition PDF into subway-data.json.

Reads us-nutrition-en.pdf (same directory) via `pdftotext -layout`, classifies
every row into menu categories / ingredient groups, and writes subway-data.json
consumed by seed-subway-full.ts.

Run: python3 scripts/parse_subway.py   (requires poppler's pdftotext)
"""
import json, re, subprocess, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
TXT = subprocess.check_output(
    ["pdftotext", "-layout", os.path.join(HERE, "us-nutrition-en.pdf"), "-"], text=True
)

SECTIONS = {"SANDWICHES","WRAPS","SALADS","PROTEIN BOWLS",
            "BREAKFAST & PIZZA & SLIDERS","BREADS & INGREDIENTS","DESSERTS & SIDES"}
SUBHEADERS = ["Cheesesteaks","Chicken","Italians","Deli Classics","Clubs",
    "Local Favorites","Fresh Fit","Kids' Mini Sub","Protein Pockets",
    'Egg Patty on 6" Artisan Italian','Egg Patty on 12" Wrap','8" Pizza','Sliders',
    "Breads","Sandwich Condiments and Toppings","Seasonings and Spices",
    "Vegetables","Cheese","Individual Proteins","Cookies & Sides","Soup"]
KEYS = ["serving","cal","fat","sat","trans","chol","sodium","carb","fiber","sugar","added","protein","vitA","vitC","ca","iron"]
GROUP_MAP = {"Breads":"Bread","Sandwich Condiments and Toppings":"Sauces",
    "Seasonings and Spices":"Seasonings","Vegetables":"Vegetables",
    "Cheese":"Cheese","Individual Proteins":"Protein"}
DEFAULT_VEG = {"Lettuce","Tomatoes (3 wheels)","Onions","Green Peppers (3 strips)","Cucumbers (3 slices)"}

def numeric(t): return re.fullmatch(r"\d+(\.\d+)?", t) is not None
def norm(s): return re.sub(r"\*+$","",s.strip()).strip()

def match_sub(s):
    for H in sorted(SUBHEADERS, key=len, reverse=True):
        if s == H: return H
        if s.startswith(H) and not s[len(H):len(H)+1].isalnum():
            return H
    return None

def menu_cat_name(section, sub, name):
    if section == "SANDWICHES":
        if sub == "Kids' Mini Sub": return ("Kids' Mini Subs", "Kids' Mini " + name)
        return ('6" Sandwiches', name)
    if section == "WRAPS":
        if sub == "Protein Pockets": return ("Protein Pockets", name + " Pocket")
        return ("Wraps", name + " Wrap")
    if section == "SALADS": return ("Salads", name + " Salad")
    if section == "PROTEIN BOWLS": return ("Protein Bowls", name + " Protein Bowl")
    if section == "BREAKFAST & PIZZA & SLIDERS":
        if sub == 'Egg Patty on 6" Artisan Italian': return ("Breakfast", name)
        if sub == 'Egg Patty on 12" Wrap': return ("Breakfast", name + " (Egg Wrap)")
        if sub == '8" Pizza': return ("Pizza", name + ' Pizza (8")')
        if sub == "Sliders": return ("Sliders", name + " Slider")
    if section == "DESSERTS & SIDES":
        if sub == "Soup": return ("Soups", name)
        return ("Cookies & Sides", name)
    return ("Other", name)

menu=[]; ingredients=[]; anomalies=[]
section=None; sub=None
for raw in TXT.splitlines():
    s=raw.strip()
    if not s: continue
    if s in SECTIONS: section=s; sub=None; continue
    toks=s.replace("<1","0.5").split()
    n=0
    for t in reversed(toks):
        if numeric(t): n+=1
        else: break
    if n>=16:
        vals={k:float(v) for k,v in zip(KEYS,[float(x) for x in toks[-16:]])}
        name=norm(" ".join(toks[:len(toks)-16]))
        if not name: anomalies.append(s[:80]); continue
        if section=="BREADS & INGREDIENTS":
            group=GROUP_MAP.get(sub or "", sub or "Other")
            # Sliced cheeses are served as 2 slices; label them so.
            if group=="Cheese" and name in {"American","Pepper Jack","Provolone"}:
                name += " (2 slices)"
            ingredients.append({"group":group,"name":name,
                "default": (group=="Bread" and "Artisan Italian" in name) or name in DEFAULT_VEG,
                **vals})
        else:
            cat,dname=menu_cat_name(section,sub,name)
            menu.append({"category":cat,"name":dname,**vals})
    else:
        m=match_sub(s)
        if m: sub=m

# Italian Herbs & Cheese isn't on the official sheet; keep the ones we added.
ingredients += [
 {"group":"Bread","name":'6" Italian Herbs & Cheese Bread',"default":False,
  "serving":77,"cal":230,"fat":5,"sat":2,"trans":0,"chol":5,"sodium":500,"carb":40,"fiber":1,"sugar":4,"added":2,"protein":9,"vitA":4,"vitC":2,"ca":90,"iron":90},
 {"group":"Bread","name":"Mini Italian Herbs & Cheese Bread","default":False,
  "serving":51,"cal":160,"fat":3.5,"sat":1.5,"trans":0,"chol":5,"sodium":340,"carb":27,"fiber":1,"sugar":3,"added":2,"protein":6,"vitA":0,"vitC":0,"ca":60,"iron":10},
]

print("menu:",len(menu),"| categories:",dict(collections.Counter(m["category"] for m in menu)))
print("ingredients:",len(ingredients),"| groups:",dict(collections.Counter(i["group"] for i in ingredients)))
print("anomalies:",anomalies)
json.dump({"menu":menu,"ingredients":ingredients}, open(os.path.join(HERE,"subway-data.json"),"w"), indent=0)
