import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Dumbbell,
  Flame,
  Footprints,
  User,
  TrendingUp,
  Plus,
  X,
  ChevronRight,
  Check,
  Scale,
  RotateCcw,
  Beef,
  Search,
  PlayCircle,
  UtensilsCrossed,
  Trash2,
  Wheat,
  Droplet,
  Trophy,
  UserPlus,
  Copy,
  Sparkles,
  Zap,
  Camera,
  Ruler,
  Target,
  Users,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { loadKey, saveKey, genId, pushLeaderboardEntry, fetchLeaderboard } from "./lib/storage";

/* ------------------------------------------------------------------ */
/*  Design tokens — "Molten track" palette                             */
/* ------------------------------------------------------------------ */
const C = {
  bg: "#0E1116",
  surface: "#181D26",
  surfaceRaised: "#212836",
  border: "#2A3140",
  coral: "#FF6B4A",
  amber: "#FFC145",
  cyan: "#5BD0C9",
  cream: "#F5F1E8",
  muted: "#7C8698",
  danger: "#E4574F",
};

const XP_PER_LEVEL = 150;
const XP_PER_SESSION = 25;
const XP_DAILY_BONUS = 15;
const levelFromXp = (xp) => Math.floor((xp || 0) / XP_PER_LEVEL) + 1;
const xpIntoLevel = (xp) => (xp || 0) % XP_PER_LEVEL;
const ftInToCm = (ft, inch) => ((Number(ft) || 0) * 12 + (Number(inch) || 0)) * 2.54;

/* ------------------------------------------------------------------ */
/*  Domain data — goals / activity                                     */
/* ------------------------------------------------------------------ */
const GOALS = {
  lose: { label: "Lose weight", calAdj: -0.2, steps: 11000, proteinPerKg: 1.6, repRange: "12–15", sets: "3", rest: "45–60s", cardio: "4–5 sessions/week of steady cardio or HIIT, 20–30 min each.", tip: "The deficit does the work — training is there to hold on to muscle while the weight comes off." },
  gain: { label: "Gain muscle", calAdj: 0.12, steps: 7000, proteinPerKg: 2.0, repRange: "6–10", sets: "4", rest: "90–120s", cardio: "1–2 short sessions/week, just enough to keep your heart healthy.", tip: "Eat in a surplus and add a little weight or a rep most weeks — that's what actually grows muscle." },
  maintain: { label: "Maintain weight", calAdj: 0, steps: 9000, proteinPerKg: 1.6, repRange: "8–12", sets: "3", rest: "60–75s", cardio: "2–3 sessions/week to stay conditioned.", tip: "Keep intake matched to output and stay consistent — maintenance is a long game, not a phase." },
  shred: { label: "Shred (cut)", calAdj: -0.15, steps: 11000, proteinPerKg: 2.2, repRange: "10–15", sets: "4", rest: "30–45s", cardio: "4–6 sessions/week, mixing steady state with intervals.", tip: "High protein and high volume in a deficit is how you lean out without losing your gains." },
};

const ACTIVITY = {
  sedentary: { label: "Sedentary (desk job, little exercise)", mult: 1.2 },
  light: { label: "Lightly active (1–3 workouts/week)", mult: 1.375 },
  moderate: { label: "Moderately active (3–5 workouts/week)", mult: 1.55 },
  active: { label: "Very active (6–7 workouts/week)", mult: 1.725 },
  athlete: { label: "Athlete (training twice a day)", mult: 1.9 },
};

/* ------------------------------------------------------------------ */
/*  Muscle & exercise library                                          */
/* ------------------------------------------------------------------ */
const MUSCLES = [
  { id: "chest", name: "Chest", blurb: "The pecs — the big pressing muscle across your upper front torso. Pushes your arm forward and across your body.", exercises: [
    { name: "Barbell Bench Press", equipment: "Barbell", steps: ["Lie on the bench with feet flat on the floor, eyes under the bar.", "Grip just outside shoulder width and unrack.", "Lower the bar under control to your mid-chest.", "Press back up to full arm extension without flaring your elbows too wide."] },
    { name: "Incline Dumbbell Press", equipment: "Dumbbells", steps: ["Set a bench to a 30–45° incline.", "Press two dumbbells up from shoulder height to above your chest.", "Lower slowly until you feel a stretch across the upper chest.", "Keep your shoulder blades pulled back the whole set."] },
    { name: "Push-Up", equipment: "Bodyweight", steps: ["Hands slightly wider than shoulders, body in a straight line.", "Lower your chest to just above the floor, elbows at about 45°.", "Push back up without letting your hips sag.", "Add a backpack or plate on your back once bodyweight gets easy."] },
    { name: "Cable Fly", equipment: "Cable machine", steps: ["Set both pulleys above shoulder height and grab a handle in each hand.", "Step forward with a slight forward lean and soft elbow bend.", "Bring your hands together in front of your chest in a wide arc.", "Control the return — don't let the weight yank your arms back."] },
  ]},
  { id: "back", name: "Back", blurb: "Lats, traps and rhomboids — the pulling muscles that build width and thickness through your torso.", exercises: [
    { name: "Pull-Up", equipment: "Pull-up bar", steps: ["Hang from the bar with hands just outside shoulder width.", "Pull your chest towards the bar, driving your elbows down.", "Squeeze your shoulder blades together at the top.", "Lower under control to a full hang — don't just drop."] },
    { name: "Bent-Over Barbell Row", equipment: "Barbell", steps: ["Hinge at the hips with a flat back, knees slightly bent.", "Let the bar hang at arm's length below your chest.", "Row the bar to your lower ribs, elbows close to your body.", "Lower with control without rounding your back."] },
    { name: "Lat Pulldown", equipment: "Cable machine", steps: ["Grip the bar wider than shoulder width and sit with thighs locked under the pad.", "Pull the bar down to your upper chest, leading with your elbows.", "Pause briefly and squeeze your lats.", "Let the bar rise back up under control."] },
    { name: "Single-Arm Dumbbell Row", equipment: "Dumbbell + bench", steps: ["Support one knee and hand on a bench, back flat.", "Row the dumbbell up towards your hip, elbow close to your body.", "Squeeze at the top before lowering slowly.", "Keep your torso still — the pull should come from your back, not momentum."] },
  ]},
  { id: "shoulders", name: "Shoulders", blurb: "Deltoids — pressing and raising movements that build rounded, capped shoulders.", exercises: [
    { name: "Overhead Press", equipment: "Barbell or dumbbells", steps: ["Stand with the weight at shoulder height, core braced.", "Press straight overhead until your arms lock out.", "Avoid arching your lower back excessively as you press.", "Lower back to shoulder height with control."] },
    { name: "Lateral Raise", equipment: "Dumbbells", steps: ["Stand holding a dumbbell in each hand at your sides.", "Raise your arms out to shoulder height, leading with your elbows.", "Pause briefly at the top, wrists slightly below elbows.", "Lower slowly — resist the urge to swing."] },
    { name: "Face Pull", equipment: "Cable machine", steps: ["Set a rope attachment at roughly face height.", "Pull the rope towards your face, splitting it apart as it arrives.", "Keep your elbows high and squeeze your rear delts.", "Return slowly under control."] },
    { name: "Arnold Press", equipment: "Dumbbells", steps: ["Start with dumbbells in front of your shoulders, palms facing you.", "Press up while rotating your palms to face forward.", "Lock out overhead, then reverse the rotation on the way down.", "Keep the movement smooth rather than jerky."] },
  ]},
  { id: "biceps", name: "Biceps", blurb: "The front of your upper arm — flexes the elbow and gives that classic 'arm' look.", exercises: [
    { name: "Barbell Curl", equipment: "Barbell", steps: ["Stand tall, grip the bar shoulder width, arms extended.", "Curl the bar up by bending your elbows, keeping them pinned to your sides.", "Squeeze at the top without swinging your back.", "Lower slowly to full extension."] },
    { name: "Dumbbell Hammer Curl", equipment: "Dumbbells", steps: ["Hold dumbbells at your sides with palms facing each other.", "Curl both up keeping your wrists neutral throughout.", "Squeeze at the top of the movement.", "Lower under control back to the start."] },
    { name: "Incline Dumbbell Curl", equipment: "Dumbbells + bench", steps: ["Sit back on an incline bench with arms hanging straight down.", "Curl the dumbbells up without letting your elbows drift forward.", "Pause and squeeze at the top.", "Lower slowly to feel a full stretch."] },
    { name: "Cable Curl", equipment: "Cable machine", steps: ["Attach a straight or EZ bar to a low pulley.", "Curl the bar up keeping your elbows fixed at your sides.", "Squeeze hard at the top of the rep.", "Control the weight back down rather than letting it drop."] },
  ]},
  { id: "triceps", name: "Triceps", blurb: "The back of your upper arm — makes up most of your arm size and extends the elbow.", exercises: [
    { name: "Close-Grip Bench Press", equipment: "Barbell", steps: ["Lie on the bench with hands about shoulder width apart.", "Lower the bar to your lower chest, elbows tucked in.", "Press back up focusing on squeezing your triceps.", "Keep your wrists straight throughout."] },
    { name: "Triceps Pushdown", equipment: "Cable machine", steps: ["Grip the bar or rope with elbows tucked at your sides.", "Push down until your arms are fully extended.", "Squeeze at the bottom for a second.", "Let the weight rise back with control, elbows staying still."] },
    { name: "Overhead Dumbbell Extension", equipment: "Dumbbell", steps: ["Hold one dumbbell with both hands overhead, arms extended.", "Lower it slowly behind your head by bending your elbows.", "Keep your upper arms still and close to your ears.", "Extend back up to full lockout."] },
    { name: "Bench Dip", equipment: "Bench", steps: ["Sit on the edge of a bench, hands next to your hips.", "Slide your hips off the bench and lower until your elbows hit 90°.", "Push back up through your palms.", "Keep your shoulders down away from your ears."] },
  ]},
  { id: "abs", name: "Abs", blurb: "Your core — stabilises your spine and shows up as definition when body fat is low enough.", exercises: [
    { name: "Hanging Leg Raise", equipment: "Pull-up bar", steps: ["Hang from the bar with your core braced.", "Raise your legs up towards your chest without swinging.", "Lower slowly under control.", "Bend your knees if straight-leg raises are too hard at first."] },
    { name: "Cable Crunch", equipment: "Cable machine", steps: ["Kneel below a high pulley holding a rope by your head.", "Crunch down, bringing your elbows towards your knees.", "Squeeze your abs hard at the bottom.", "Rise back up under control, keeping tension on."] },
    { name: "Plank", equipment: "Bodyweight", steps: ["Rest on your forearms and toes, body in a straight line.", "Brace your core and squeeze your glutes.", "Hold the position without letting your hips sag or pike.", "Breathe steadily throughout the hold."] },
    { name: "Russian Twist", equipment: "Bodyweight or plate", steps: ["Sit with knees bent, leaning back slightly, feet off the floor.", "Rotate your torso to tap the floor on each side.", "Keep your chest up rather than rounding forward.", "Move with control rather than speed."] },
  ]},
  { id: "quads", name: "Quads", blurb: "The front of your thigh — the main driver in squatting, lunging and stepping movements.", exercises: [
    { name: "Barbell Back Squat", equipment: "Barbell", steps: ["Bar across your upper back, feet shoulder width apart.", "Sit down and back, keeping your chest up.", "Go to at least parallel, knees tracking over your toes.", "Drive through your whole foot to stand back up."] },
    { name: "Leg Press", equipment: "Leg press machine", steps: ["Sit in the machine with feet shoulder width on the platform.", "Lower the platform until your knees reach about 90°.", "Press back up without locking your knees out hard.", "Keep your lower back flat against the pad."] },
    { name: "Walking Lunge", equipment: "Bodyweight or dumbbells", steps: ["Step forward into a lunge, back knee dropping towards the floor.", "Push through your front foot to bring your back leg through into the next step.", "Keep your torso upright throughout.", "Alternate legs as you move forward."] },
    { name: "Leg Extension", equipment: "Leg extension machine", steps: ["Sit with the pad resting on your lower shins.", "Extend your legs until they're straight, squeezing your quads.", "Pause briefly at the top.", "Lower slowly rather than letting the weight drop."] },
  ]},
  { id: "hamstrings", name: "Hamstrings", blurb: "The back of your thigh — works opposite your quads, key in hip hinges and sprinting power.", exercises: [
    { name: "Romanian Deadlift", equipment: "Barbell or dumbbells", steps: ["Hold the weight in front of your thighs, knees slightly bent.", "Hinge at the hips, pushing them back as the weight lowers.", "Keep the bar close to your legs and your back flat.", "Drive your hips forward to return to standing."] },
    { name: "Lying Leg Curl", equipment: "Leg curl machine", steps: ["Lie face down with the pad against your lower calves.", "Curl your heels towards your glutes.", "Squeeze hard at the top of the movement.", "Lower slowly rather than letting it snap back."] },
    { name: "Glute-Ham Raise", equipment: "GHD bench", steps: ["Anchor your feet and start with your body straight.", "Lower your torso forward under control using your hamstrings to slow you.", "Curl back up to the starting position.", "Keep your hips extended throughout the movement."] },
    { name: "Good Morning", equipment: "Barbell", steps: ["Bar across your upper back, feet shoulder width apart.", "Hinge forward at the hips, keeping a soft knee bend.", "Lower until you feel a strong hamstring stretch.", "Drive your hips forward to stand back up tall."] },
  ]},
  { id: "glutes", name: "Glutes", blurb: "Your glute muscles — the biggest driver of hip power, key for squats, sprints and posture.", exercises: [
    { name: "Hip Thrust", equipment: "Barbell + bench", steps: ["Sit with your upper back against a bench, bar over your hips.", "Drive through your heels to lift your hips up.", "Squeeze your glutes hard at the top, hips fully extended.", "Lower under control without letting the bar bounce."] },
    { name: "Barbell Glute Bridge", equipment: "Barbell", steps: ["Lie on your back with knees bent, bar across your hips.", "Push through your heels to raise your hips off the floor.", "Squeeze at the top, then lower with control.", "Keep your chin tucked and ribs down throughout."] },
    { name: "Cable Kickback", equipment: "Cable machine", steps: ["Attach an ankle cuff to a low pulley and clip it to your ankle.", "Hinge slightly forward holding the machine for balance.", "Kick your leg back and up, squeezing your glute at the top.", "Return under control without swinging."] },
    { name: "Bulgarian Split Squat", equipment: "Bodyweight or dumbbells", steps: ["Rest your back foot on a bench behind you.", "Lower your back knee towards the floor, front knee tracking over your toes.", "Drive through your front heel to stand back up.", "Keep most of your weight on the front leg."] },
  ]},
  { id: "calves", name: "Calves", blurb: "The back of your lower leg — small but stubborn, responds best to high volume and full range of motion.", exercises: [
    { name: "Standing Calf Raise", equipment: "Calf raise machine or dumbbells", steps: ["Stand with the balls of your feet on a raised edge.", "Rise up onto your toes as high as you can.", "Pause briefly at the top.", "Lower slowly until you feel a full stretch in your calf."] },
    { name: "Seated Calf Raise", equipment: "Seated calf machine", steps: ["Sit with the pad resting just above your knees.", "Rise up onto your toes, lifting the weight.", "Squeeze at the top of the movement.", "Lower fully to stretch through the bottom."] },
    { name: "Single-Leg Calf Raise", equipment: "Bodyweight", steps: ["Stand on one foot, holding something for balance if needed.", "Rise up onto your toes as high as possible.", "Lower slowly and under full control.", "Complete all reps on one side before switching legs."] },
    { name: "Jump Rope", equipment: "Skipping rope", steps: ["Keep a soft, springy bounce driven mostly from your ankles.", "Stay light on your feet with a small, quick hop.", "Keep your core braced and posture tall.", "Build up time gradually rather than going all-out from the start."] },
  ]},
];

const MUSCLE_MAP = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
const youtubeSearchUrl = (name) => `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " exercise tutorial form")}`;

const HOTSPOTS = {
  front: [
    { id: "shoulders", cx: 87, cy: 148, rx: 23, ry: 27 }, { id: "shoulders", cx: 213, cy: 148, rx: 23, ry: 27 },
    { id: "chest", cx: 122, cy: 168, rx: 30, ry: 25 }, { id: "chest", cx: 178, cy: 168, rx: 30, ry: 25 },
    { id: "biceps", cx: 68, cy: 216, rx: 15, ry: 32 }, { id: "biceps", cx: 232, cy: 216, rx: 15, ry: 32 },
    { id: "abs", rectX: 119, rectY: 198, rectW: 62, rectH: 100, rectRx: 14 },
    { id: "quads", rectX: 100, rectY: 340, rectW: 42, rectH: 130, rectRx: 16 }, { id: "quads", rectX: 158, rectY: 340, rectW: 42, rectH: 130, rectRx: 16 },
    { id: "calves", rectX: 104, rectY: 492, rectW: 34, rectH: 108, rectRx: 14 }, { id: "calves", rectX: 162, rectY: 492, rectW: 34, rectH: 108, rectRx: 14 },
  ],
  back: [
    { id: "shoulders", cx: 87, cy: 148, rx: 23, ry: 27 }, { id: "shoulders", cx: 213, cy: 148, rx: 23, ry: 27 },
    { id: "back", rectX: 108, rectY: 148, rectW: 84, rectH: 118, rectRx: 18 },
    { id: "triceps", cx: 68, cy: 216, rx: 15, ry: 32 }, { id: "triceps", cx: 232, cy: 216, rx: 15, ry: 32 },
    { id: "glutes", rectX: 106, rectY: 300, rectW: 88, rectH: 56, rectRx: 26 },
    { id: "hamstrings", rectX: 100, rectY: 362, rectW: 42, rectH: 108, rectRx: 16 }, { id: "hamstrings", rectX: 158, rectY: 362, rectW: 42, rectH: 108, rectRx: 16 },
    { id: "calves", rectX: 104, rectY: 492, rectW: 34, rectH: 108, rectRx: 14 }, { id: "calves", rectX: 162, rectY: 492, rectW: 34, rectH: 108, rectRx: 14 },
  ],
};

const FOOD_DB = [
  { name: "Chicken breast (cooked)", kcal: 165, p: 31, c: 0, f: 3.6 }, { name: "Turkey breast (cooked)", kcal: 135, p: 30, c: 0, f: 1 },
  { name: "Beef mince 5% (cooked)", kcal: 174, p: 26, c: 0, f: 7 }, { name: "Beef steak (cooked)", kcal: 271, p: 25, c: 0, f: 19 },
  { name: "Salmon (cooked)", kcal: 208, p: 20, c: 0, f: 13 }, { name: "Cod (cooked)", kcal: 105, p: 23, c: 0, f: 0.9 },
  { name: "Tuna (canned in water)", kcal: 116, p: 26, c: 0, f: 1 }, { name: "Prawns (cooked)", kcal: 99, p: 24, c: 0.2, f: 0.3 },
  { name: "Whole eggs", kcal: 155, p: 13, c: 1.1, f: 11 }, { name: "Egg whites", kcal: 52, p: 11, c: 0.7, f: 0.2 },
  { name: "Tofu", kcal: 76, p: 8, c: 1.9, f: 4.8 }, { name: "Greek yoghurt (0%)", kcal: 59, p: 10, c: 3.6, f: 0.4 },
  { name: "Cottage cheese", kcal: 98, p: 11, c: 3.4, f: 4.3 }, { name: "Cheddar cheese", kcal: 404, p: 25, c: 1.3, f: 33 },
  { name: "Whole milk", kcal: 61, p: 3.2, c: 4.8, f: 3.3 }, { name: "Skimmed milk", kcal: 35, p: 3.4, c: 5, f: 0.1 },
  { name: "Whey protein powder", kcal: 400, p: 80, c: 8, f: 6 }, { name: "White rice (cooked)", kcal: 130, p: 2.7, c: 28, f: 0.3 },
  { name: "Brown rice (cooked)", kcal: 123, p: 2.7, c: 25, f: 1 }, { name: "Oats (dry)", kcal: 389, p: 16.9, c: 66, f: 6.9 },
  { name: "Pasta (cooked)", kcal: 131, p: 5, c: 25, f: 1.1 }, { name: "Whole wheat bread", kcal: 247, p: 13, c: 41, f: 3.4 },
  { name: "White bread", kcal: 265, p: 9, c: 49, f: 3.2 }, { name: "Sweet potato (cooked)", kcal: 90, p: 2, c: 21, f: 0.1 },
  { name: "White potato (cooked)", kcal: 87, p: 1.9, c: 20, f: 0.1 }, { name: "Quinoa (cooked)", kcal: 120, p: 4.4, c: 21, f: 1.9 },
  { name: "Lentils (cooked)", kcal: 116, p: 9, c: 20, f: 0.4 }, { name: "Chickpeas (cooked)", kcal: 164, p: 9, c: 27, f: 2.6 },
  { name: "Black beans (cooked)", kcal: 132, p: 8.9, c: 24, f: 0.5 }, { name: "Rice cakes", kcal: 387, p: 8, c: 81, f: 2.8 },
  { name: "Banana", kcal: 89, p: 1.1, c: 23, f: 0.3 }, { name: "Apple", kcal: 52, p: 0.3, c: 14, f: 0.2 },
  { name: "Orange", kcal: 47, p: 0.9, c: 12, f: 0.1 }, { name: "Strawberries", kcal: 32, p: 0.7, c: 7.7, f: 0.3 },
  { name: "Blueberries", kcal: 57, p: 0.7, c: 14, f: 0.3 }, { name: "Broccoli", kcal: 34, p: 2.8, c: 7, f: 0.4 },
  { name: "Spinach", kcal: 23, p: 2.9, c: 3.6, f: 0.4 }, { name: "Carrot", kcal: 41, p: 0.9, c: 10, f: 0.2 },
  { name: "Cucumber", kcal: 15, p: 0.7, c: 3.6, f: 0.1 }, { name: "Avocado", kcal: 160, p: 2, c: 9, f: 15 },
  { name: "Almonds", kcal: 579, p: 21, c: 22, f: 50 }, { name: "Peanut butter", kcal: 588, p: 25, c: 20, f: 50 },
  { name: "Olive oil", kcal: 884, p: 0, c: 0, f: 100 }, { name: "Butter", kcal: 717, p: 0.9, c: 0.1, f: 81 },
  { name: "Honey", kcal: 304, p: 0.3, c: 82, f: 0 }, { name: "Dark chocolate", kcal: 546, p: 7.8, c: 46, f: 31 },
  { name: "Protein bar (avg)", kcal: 350, p: 20, c: 35, f: 12 },
];

/* ------------------------------------------------------------------ */
/*  Image resizing for profile photos                                  */
/* ------------------------------------------------------------------ */
const todayStr = () => new Date().toISOString().slice(0, 10);

function resizeImageToDataUrl(file, maxDim = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) { if (width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; } }
        else { if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; } }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ------------------------------------------------------------------ */
/*  Calculations                                                       */
/* ------------------------------------------------------------------ */
function calcTargets(profile) {
  if (!profile) return null;
  const { gender, age, weightKg, activity, goal, heightFt, heightIn } = profile;
  const heightCm = ftInToCm(heightFt, heightIn);
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (gender === "male" ? 5 : -161);
  const tdee = bmr * (ACTIVITY[activity]?.mult || 1.375);
  const g = GOALS[goal] || GOALS.maintain;
  const calories = Math.round(tdee * (1 + g.calAdj));
  const protein = Math.round(weightKg * g.proteinPerKg);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories, protein, steps: g.steps, goal: g };
}

/* ------------------------------------------------------------------ */
/*  Small shared UI bits                                               */
/* ------------------------------------------------------------------ */
function SectionLabel({ eyebrow, title, sub }) {
  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.28em]" style={{ color: C.coral }}>{eyebrow}</div>
      <h1 className="text-[26px] font-black uppercase text-white leading-tight mt-1">{title}</h1>
      {sub && <p className="text-sm mt-1.5 leading-snug" style={{ color: C.muted }}>{sub}</p>}
    </div>
  );
}

function Ring({ pct, size, stroke, color, track, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, pct) / 100);
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 0.4s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0 }} className="flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function LevelBadge({ xp, compact }) {
  const level = levelFromXp(xp);
  const pct = Math.round((xpIntoLevel(xp) / XP_PER_LEVEL) * 100);
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="px-2 py-1 rounded-lg text-xs font-black" style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.amber})`, color: "#1A0E08" }}>LV {level}</div>
        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.amber }} /></div>
      </div>
    );
  }
  return null;
}

function Avatar({ photo, name, size = 36 }) {
  if (photo) return <img src={photo} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.border}` }} />;
  const letter = (name || "A").trim().charAt(0).toUpperCase() || "A";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${C.coral}, ${C.amber})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#1A0E08", fontSize: size * 0.42 }}>
      {letter}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero illustration for the welcome screen                           */
/* ------------------------------------------------------------------ */
function HeroArt() {
  return (
    <div className="relative flex justify-center items-center" style={{ height: 260 }}>
      <svg viewBox="0 0 320 320" style={{ width: 260, height: 260 }}>
        <defs>
          <radialGradient id="heroGlow" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={C.coral} stopOpacity="0.35" />
            <stop offset="100%" stopColor={C.coral} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="heroBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={C.amber} />
            <stop offset="100%" stopColor={C.coral} />
          </linearGradient>
        </defs>
        <circle cx="160" cy="150" r="150" fill="url(#heroGlow)" />
        {[0, 1, 2].map((i) => <circle key={i} cx="160" cy="150" r={70 + i * 30} fill="none" stroke={C.border} strokeOpacity="0.5" strokeWidth="1" />)}
        <g fill="url(#heroBody)">
          <polygon points="128,232 152,232 148,300 126,300" />
          <polygon points="168,232 192,232 194,300 172,300" />
          <polygon points="112,140 208,140 196,232 124,232" />
          <rect x="148" y="112" width="24" height="24" rx="6" />
          <circle cx="160" cy="94" r="32" />
          <ellipse cx="104" cy="146" rx="22" ry="26" />
          <ellipse cx="216" cy="146" rx="22" ry="26" />
          <ellipse cx="76" cy="176" rx="21" ry="32" />
          <rect x="62" y="130" width="26" height="52" rx="13" />
          <circle cx="75" cy="122" r="15" />
          <ellipse cx="244" cy="176" rx="21" ry="32" />
          <rect x="232" y="130" width="26" height="52" rx="13" />
          <circle cx="245" cy="122" r="15" />
        </g>
        <g stroke="#2A160C" strokeOpacity="0.35" strokeWidth="2.5" fill="none">
          <line x1="160" y1="152" x2="160" y2="225" />
          <line x1="134" y1="188" x2="186" y2="188" />
          <line x1="134" y1="205" x2="186" y2="205" />
          <path d="M 130 150 Q 160 168 190 150" />
        </g>
      </svg>
      <div className="absolute" style={{ top: 6, right: 18 }}><Sparkles size={22} color={C.amber} /></div>
      <div className="absolute" style={{ bottom: 18, left: 10 }}><Zap size={20} color={C.cyan} /></div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Body diagram — shaded, more muscular silhouette                    */
/* ------------------------------------------------------------------ */
function BodyDiagram({ view, gender, onSelect }) {
  const isFemale = gender === "female";
  const shoulderW = (isFemale ? 86 : 106) + (view === "back" ? 6 : 0);
  const waistW = isFemale ? 38 : 54;
  const hipW = isFemale ? 80 : 66;
  const torsoTop = 150 - shoulderW / 2;
  const torsoTopR = 150 + shoulderW / 2;
  const torsoPoints = `${torsoTop},140 ${torsoTopR},140 ${150 + waistW / 2 + 6},240 ${150 + hipW / 2},300 ${150 - hipW / 2},300 ${150 - waistW / 2 - 6},240`;
  const armW = isFemale ? 22 : 26;
  const armX = 150 - shoulderW / 2 - armW;
  const armXR = 150 + shoulderW / 2;
  const line = "#171A20";
  const hotspots = HOTSPOTS[view];

  return (
    <svg viewBox="0 0 300 640" className="w-full h-full select-none" style={{ maxHeight: "50vh" }}>
      <defs>
        <linearGradient id="baseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2C3441" />
          <stop offset="100%" stopColor="#1A1F27" />
        </linearGradient>
        <linearGradient id="muscleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#374156" />
          <stop offset="100%" stopColor="#232B37" />
        </linearGradient>
      </defs>

      <polygon points={`138,124 162,124 ${torsoTopR},142 ${torsoTop},142`} fill="url(#muscleGrad)" />
      <polygon points={torsoPoints} fill="url(#baseGrad)" />
      <ellipse cx={torsoTop + 4} cy="150" rx="26" ry="30" fill="url(#muscleGrad)" />
      <ellipse cx={torsoTopR - 4} cy="150" rx="26" ry="30" fill="url(#muscleGrad)" />
      <rect x="138" y="122" width="24" height="24" rx="6" fill="url(#baseGrad)" />
      <circle cx="150" cy={isFemale ? 92 : 95} r={isFemale ? 33 : 37} fill="url(#baseGrad)" />

      {view === "front" ? (
        <>
          <ellipse cx="126" cy="172" rx="28" ry="24" fill="url(#muscleGrad)" />
          <ellipse cx="174" cy="172" rx="28" ry="24" fill="url(#muscleGrad)" />
          <g stroke={line} strokeOpacity="0.4" strokeWidth="2" fill="none">
            <line x1="150" y1="156" x2="150" y2="295" />
            <line x1="126" y1="222" x2="174" y2="222" />
            <line x1="128" y1="246" x2="172" y2="246" />
            <line x1="130" y1="270" x2="170" y2="270" />
          </g>
        </>
      ) : (
        <>
          <path d={`M ${torsoTop + 6} 150 Q 150 176 ${torsoTopR - 6} 150 L ${150 + waistW / 2} 236 Q 150 250 ${150 - waistW / 2} 236 Z`} fill="url(#muscleGrad)" opacity="0.85" />
          <line x1="150" y1="150" x2="150" y2="236" stroke={line} strokeOpacity="0.35" strokeWidth="2" />
        </>
      )}

      <ellipse cx={armX + armW / 2} cy="188" rx={armW / 2 + 6} ry="35" fill="url(#muscleGrad)" />
      <rect x={armX + 3} y="216" width={armW - 6} height="96" rx="10" fill="url(#baseGrad)" />
      <ellipse cx={armXR + armW / 2} cy="188" rx={armW / 2 + 6} ry="35" fill="url(#muscleGrad)" />
      <rect x={armXR + 3} y="216" width={armW - 6} height="96" rx="10" fill="url(#baseGrad)" />

      <polygon points="96,340 150,340 143,462 103,462" fill="url(#baseGrad)" />
      <polygon points="150,340 204,340 197,462 157,462" fill="url(#baseGrad)" />
      <line x1="122" y1="352" x2="119" y2="452" stroke={line} strokeOpacity="0.3" strokeWidth="2" />
      <line x1="178" y1="352" x2="181" y2="452" stroke={line} strokeOpacity="0.3" strokeWidth="2" />
      {view === "back" && <ellipse cx="150" cy="322" rx="48" ry="30" fill="url(#muscleGrad)" />}

      <ellipse cx="121" cy="500" rx="22" ry="28" fill="url(#muscleGrad)" />
      <rect x="110" y="558" width="22" height="40" rx="9" fill="url(#baseGrad)" />
      <ellipse cx="179" cy="500" rx="22" ry="28" fill="url(#muscleGrad)" />
      <rect x="168" y="558" width="22" height="40" rx="9" fill="url(#baseGrad)" />

      {hotspots.map((h, i) => {
        const commonProps = { key: `${h.id}-${i}`, onClick: () => onSelect(h.id), className: "cursor-pointer transition-all duration-150", fill: C.coral, fillOpacity: 0.35, stroke: C.coral, strokeWidth: 1.5, strokeOpacity: 0.7 };
        if (h.rectX !== undefined) return <rect {...commonProps} x={h.rectX} y={h.rectY} width={h.rectW} height={h.rectH} rx={h.rectRx} />;
        return <ellipse {...commonProps} cx={h.cx} cy={h.cy} rx={h.rx} ry={h.ry} />;
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Onboarding                                                          */
/* ------------------------------------------------------------------ */
const STEP_TIPS = [
  null,
  { icon: Dumbbell, tip: "Your body map adapts to fit you — nothing generic here." },
  { icon: Ruler, tip: "Precise numbers here means precise targets later — no guessing at your calories." },
  { icon: Flame, tip: "Be honest about activity — overestimating this is the #1 reason calorie targets miss." },
  { icon: Target, tip: "You can change your goal any time — training and food targets update instantly." },
  { icon: Users, tip: "Your first 25 XP is waiting the moment you log a workout." },
];

function StepTip({ step }) {
  const t = STEP_TIPS[step];
  if (!t) return null;
  const Icon = t.icon;
  return (
    <div className="flex items-start gap-3 rounded-2xl p-3.5 mt-5" style={{ background: C.surface, borderLeft: `3px solid ${C.coral}` }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.surfaceRaised }}><Icon size={16} color={C.amber} /></div>
      <p className="text-xs leading-snug italic" style={{ color: C.muted }}>{t.tip}</p>
    </div>
  );
}

function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ gender: "male", age: "", heightFt: "", heightIn: "", weightKg: "", activity: "light", goal: "maintain", displayName: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canContinue = () => {
    if (step === 0) return true;
    if (step === 1) return !!form.gender;
    if (step === 2) return form.age && form.heightFt !== "" && form.heightIn !== "" && form.weightKg;
    if (step === 3) return !!form.activity;
    if (step === 4) return !!form.goal;
    return true;
  };
  const PillButton = ({ active, onClick, children }) => (
    <button onClick={onClick} className="w-full text-left px-4 py-3 rounded-2xl text-sm font-semibold transition-colors" style={{ background: active ? C.coral : C.surface, color: active ? "#1A0E08" : C.cream, border: `1px solid ${active ? C.coral : C.border}` }}>{children}</button>
  );

  return (
    <div className="flex flex-col h-full px-6 pt-8 pb-6" style={{ background: C.bg, color: C.cream }}>
      {step === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <HeroArt />
          <div className="text-white font-black uppercase text-3xl tracking-tight mt-2">LockIn</div>
          <p className="text-sm mt-2 max-w-[260px]" style={{ color: C.muted }}>Build the body you're after — the right exercises, the right numbers, every session logged.</p>
        </div>
      ) : (
        <>
          <SectionLabel eyebrow="SET UP" title="Build your plan" sub="A few details so your targets and workouts actually fit you." />
          <div className="flex-1 overflow-y-auto mt-6">
            {step === 1 && (
              <div className="grid grid-cols-2 gap-3">
                {["male", "female"].map((g) => <button key={g} onClick={() => set("gender", g)} className="py-5 rounded-2xl text-sm font-black uppercase tracking-wide" style={{ background: form.gender === g ? C.coral : C.surface, color: form.gender === g ? "#1A0E08" : C.cream, border: `1px solid ${form.gender === g ? C.coral : C.border}` }}>{g}</button>)}
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Age (years)</div>
                  <input type="number" value={form.age} onChange={(e) => set("age", e.target.value)} className="w-full rounded-2xl px-4 py-3 text-lg font-bold outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} placeholder="0" />
                </div>
                <div>
                  <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Height</div>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input type="number" value={form.heightFt} onChange={(e) => set("heightFt", e.target.value)} className="w-full rounded-2xl px-4 py-3 text-lg font-bold outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} placeholder="5" />
                      <span className="absolute right-4 top-3.5 text-sm" style={{ color: C.muted }}>ft</span>
                    </div>
                    <div className="flex-1 relative">
                      <input type="number" value={form.heightIn} onChange={(e) => set("heightIn", e.target.value)} className="w-full rounded-2xl px-4 py-3 text-lg font-bold outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} placeholder="10" />
                      <span className="absolute right-4 top-3.5 text-sm" style={{ color: C.muted }}>in</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Weight (kg)</div>
                  <input type="number" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} className="w-full rounded-2xl px-4 py-3 text-lg font-bold outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} placeholder="0" />
                </div>
              </div>
            )}
            {step === 3 && <div className="space-y-2">{Object.entries(ACTIVITY).map(([key, a]) => <PillButton key={key} active={form.activity === key} onClick={() => set("activity", key)}>{a.label}</PillButton>)}</div>}
            {step === 4 && <div className="space-y-2">{Object.entries(GOALS).map(([key, g]) => <PillButton key={key} active={form.goal === key} onClick={() => set("goal", key)}><div className="font-black">{g.label}</div></PillButton>)}</div>}
            {step === 5 && (
              <div>
                <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Display name (for the leaderboard)</div>
                <input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="e.g. Dan Y" maxLength={20} className="w-full rounded-2xl px-4 py-3 text-lg font-bold outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
                <p className="text-xs mt-3 leading-snug" style={{ color: C.muted }}>This name (and your level/XP) is visible to anyone else using this app on the shared leaderboard. Leave it blank to stay "Anonymous". You can add a profile photo and change any of this later in Profile.</p>
              </div>
            )}
            <StepTip step={step} />
          </div>
        </>
      )}

      <div className="flex gap-3 pt-4">
        {step > 0 && <button onClick={() => setStep((s) => s - 1)} className="flex-1 py-3.5 rounded-2xl font-bold uppercase text-sm" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }}>Back</button>}
        <button
          disabled={!canContinue()}
          onClick={() => {
            if (step < 5) setStep((s) => s + 1);
            else onComplete({ ...form, age: Number(form.age), heightFt: Number(form.heightFt), heightIn: Number(form.heightIn), weightKg: Number(form.weightKg), xp: 0 });
          }}
          className="flex-1 py-3.5 rounded-2xl font-black uppercase text-sm disabled:opacity-40"
          style={{ background: C.coral, color: "#1A0E08" }}
        >
          {step === 0 ? "Let's go" : step < 5 ? "Continue" : "Start training"}
        </button>
      </div>
      <div className="flex gap-1.5 justify-center mt-5">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 22 : 8, background: i <= step ? C.coral : C.border }} />)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add custom exercise form                                            */
/* ------------------------------------------------------------------ */
function AddExerciseForm({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Exercise name" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
      <input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Equipment (optional)" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How to do it (optional)" rows={3} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }}>Cancel</button>
        <button disabled={!name.trim()} onClick={() => name.trim() && onAdd({ name: name.trim(), equipment: equipment.trim() || "Your choice", steps: notes.trim() ? [notes.trim()] : [] })} className="flex-1 py-2.5 rounded-xl text-sm font-black disabled:opacity-40" style={{ background: C.coral, color: "#1A0E08" }}>Add exercise</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Muscle detail sheet                                                 */
/* ------------------------------------------------------------------ */
function MuscleSheet({ muscleId, profile, sessionCounts, customExercises, inDraft, onClose, onToggleDraft, onAddCustom, onRemoveCustom }) {
  const muscle = MUSCLE_MAP[muscleId];
  const [openExercise, setOpenExercise] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  if (!muscle) return null;
  const g = GOALS[profile.goal] || GOALS.maintain;
  const counts = sessionCounts[muscleId] || { count: 0, lastDate: null };
  const custom = (customExercises[muscleId] || []).map((e) => ({ ...e, isCustom: true }));
  const allExercises = [...muscle.exercises, ...custom];

  return (
    <div className="fixed inset-0 z-30 flex items-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full rounded-t-3xl px-5 pt-5 pb-6 max-h-[85vh] overflow-y-auto" style={{ background: C.bg, borderTop: `1px solid ${C.border}` }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[11px] font-bold tracking-[0.25em]" style={{ color: C.cyan }}>MUSCLE GROUP</div>
            <h2 className="text-2xl font-black uppercase text-white">{muscle.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full" style={{ background: C.surface }}><X size={18} color={C.cream} /></button>
        </div>
        <p className="text-sm mt-2 leading-snug" style={{ color: C.muted }}>{muscle.blurb}</p>

        <div className="mt-4 rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>For your goal — {g.label}</div>
          <div className="text-white font-black text-lg mt-1">{g.repRange} reps · {g.sets} sets · {g.rest} rest</div>
        </div>

        {counts.count > 0 && (
          <div className="mt-3 text-xs flex items-center gap-1.5 font-semibold" style={{ color: C.cyan }}>
            <RotateCcw size={13} /> You've trained {muscle.name.toLowerCase()} {counts.count} time{counts.count === 1 ? "" : "s"}{counts.lastDate ? ` · last on ${counts.lastDate}` : ""}
          </div>
        )}

        <div className="mt-5 space-y-2.5">
          {allExercises.map((ex) => (
            <div key={ex.name} className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <button className="w-full flex items-center justify-between px-4 py-3.5" onClick={() => setOpenExercise(openExercise === ex.name ? null : ex.name)}>
                <div className="text-left flex items-center gap-2">
                  <div>
                    <div className="text-white font-bold text-sm flex items-center gap-1.5">
                      {ex.name}
                      {ex.isCustom && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: C.surfaceRaised, color: C.amber }}>YOURS</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: C.muted }}>{ex.equipment}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {ex.isCustom && <span onClick={(e) => { e.stopPropagation(); onRemoveCustom(muscleId, ex.id); }} className="p-1.5 rounded-full" style={{ background: C.surfaceRaised }}><Trash2 size={13} color={C.danger} /></span>}
                  <ChevronRight size={18} color={C.muted} style={{ transform: openExercise === ex.name ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                </div>
              </button>
              {openExercise === ex.name && (
                <div className="px-4 pb-4" style={{ borderTop: `1px solid ${C.border}` }}>
                  {ex.steps.length > 0 && (
                    <>
                      <div className="text-xs font-bold uppercase tracking-wide mt-3 mb-2" style={{ color: C.coral }}>How to do it</div>
                      <ol className="space-y-1.5 mb-3">{ex.steps.map((s, i) => <li key={i} className="text-sm flex gap-2" style={{ color: C.cream }}><span className="font-black" style={{ color: C.cyan }}>{i + 1}.</span><span>{s}</span></li>)}</ol>
                    </>
                  )}
                  <a href={youtubeSearchUrl(ex.name)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold mt-3" style={{ background: C.surfaceRaised, color: C.cream, border: `1px solid ${C.border}` }}><PlayCircle size={16} color={C.coral} /> Watch on YouTube</a>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3">
          {showAddForm ? (
            <AddExerciseForm onCancel={() => setShowAddForm(false)} onAdd={(ex) => { onAddCustom(muscleId, ex); setShowAddForm(false); }} />
          ) : (
            <button onClick={() => setShowAddForm(true)} className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2" style={{ background: C.surface, color: C.cream, border: `1px dashed ${C.border}` }}><Plus size={16} color={C.amber} /> Add your own exercise</button>
          )}
        </div>

        <button
          onClick={() => onToggleDraft(muscleId)}
          className="w-full mt-4 py-3.5 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2"
          style={{ background: inDraft ? C.surfaceRaised : C.coral, color: inDraft ? C.cream : "#1A0E08", border: inDraft ? `1px solid ${C.coral}` : "none" }}
        >
          <Check size={18} /> {inDraft ? "Added to today's visit — tap to remove" : "Add to today's visit"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom (freeform) workout modal                                     */
/* ------------------------------------------------------------------ */
function CustomWorkoutModal({ onClose, onSubmit }) {
  const [label, setLabel] = useState("");
  return (
    <div className="fixed inset-0 z-30 flex items-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full rounded-t-3xl px-5 pt-5 pb-6" style={{ background: C.bg, borderTop: `1px solid ${C.border}` }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: C.border }} />
        <div className="text-[11px] font-bold tracking-[0.25em]" style={{ color: C.cyan }}>NOT ON THE MAP?</div>
        <h2 className="text-xl font-black uppercase text-white mt-1">Log your own workout</h2>
        <p className="text-sm mt-1.5" style={{ color: C.muted }}>Football training, a run, a class — anything that isn't tied to one muscle.</p>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Five-a-side football" className="w-full rounded-2xl px-4 py-3 text-base font-semibold outline-none mt-4" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
        <button disabled={!label.trim()} onClick={() => label.trim() && onSubmit(label.trim())} className="w-full mt-4 py-3.5 rounded-2xl font-black uppercase text-sm disabled:opacity-40 flex items-center justify-center gap-2" style={{ background: C.coral, color: "#1A0E08" }}><Check size={18} /> Log it <span className="opacity-70">· +{XP_PER_SESSION} XP</span></button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard tab                                                       */
/* ------------------------------------------------------------------ */
function Dashboard({ targets, dailyLog, onGoFood, macros }) {
  const g = targets.goal;
  const calPct = (dailyLog.caloriesTotal / targets.calories) * 100;
  const stepPct = (dailyLog.steps / targets.steps) * 100;
  return (
    <div className="px-5 pt-6 pb-4">
      <SectionLabel eyebrow="TODAY" title={g.label} sub={g.tip} />
      <div className="rounded-3xl mt-5 p-5 flex items-center justify-around" style={{ background: `linear-gradient(155deg, ${C.surfaceRaised}, ${C.surface})`, border: `1px solid ${C.border}` }}>
        <Ring pct={calPct} size={118} stroke={10} color={C.coral} track={C.border}><Flame size={16} color={C.coral} /><div className="text-white font-black text-lg mt-0.5">{dailyLog.caloriesTotal}</div><div className="text-[10px] font-bold" style={{ color: C.muted }}>/ {targets.calories} kcal</div></Ring>
        <Ring pct={stepPct} size={118} stroke={10} color={C.cyan} track={C.border}><Footprints size={16} color={C.cyan} /><div className="text-white font-black text-lg mt-0.5">{(dailyLog.steps / 1000).toFixed(1)}k</div><div className="text-[10px] font-bold" style={{ color: C.muted }}>/ {(targets.steps / 1000).toFixed(0)}k steps</div></Ring>
      </div>
      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <div className="rounded-2xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}><Beef size={14} color={C.coral} /><div className="text-white font-black text-base mt-1">{macros.p}g</div><div className="text-[10px] font-bold" style={{ color: C.muted }}>Protein / {targets.protein}g</div></div>
        <div className="rounded-2xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}><Wheat size={14} color={C.amber} /><div className="text-white font-black text-base mt-1">{macros.c}g</div><div className="text-[10px] font-bold" style={{ color: C.muted }}>Carbs</div></div>
        <div className="rounded-2xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}><Droplet size={14} color={C.cyan} /><div className="text-white font-black text-base mt-1">{macros.f}g</div><div className="text-[10px] font-bold" style={{ color: C.muted }}>Fat</div></div>
      </div>
      <div className="rounded-2xl p-4 mt-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>Cardio for your goal</div>
        <p className="text-sm mt-1 text-white leading-snug">{g.cardio}</p>
      </div>
      <button onClick={onGoFood} className="w-full mt-4 py-3.5 rounded-2xl font-black uppercase text-sm flex items-center justify-center gap-2" style={{ background: C.coral, color: "#1A0E08" }}><UtensilsCrossed size={17} /> Log food</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add custom food form                                                */
/* ------------------------------------------------------------------ */
function AddFoodForm({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const field = (label, val, setVal) => (
    <div className="flex-1">
      <div className="text-[10px] font-bold mb-1 uppercase tracking-wide" style={{ color: C.muted }}>{label}</div>
      <input type="number" value={val} onChange={(e) => setVal(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} placeholder="0" />
    </div>
  );
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
      <div>
        <div className="text-[10px] font-bold mb-1 uppercase tracking-wide" style={{ color: C.muted }}>Food name</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mum's chicken curry" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
      </div>
      <div className="flex gap-2">{field("Calories (kcal)", kcal, setKcal)}{field("Protein (g)", p, setP)}</div>
      <div className="flex gap-2">{field("Carbs (g)", c, setC)}{field("Fat (g)", f, setF)}</div>
      <p className="text-xs leading-snug" style={{ color: C.muted }}>Enter the totals for the amount you actually ate — this gets logged now and saved so you can add it again in one tap next time.</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }}>Cancel</button>
        <button
          disabled={!name.trim() || !kcal}
          onClick={() => name.trim() && kcal && onSubmit({ name: name.trim(), kcal: Math.round(Number(kcal) || 0), p: Number(p) || 0, c: Number(c) || 0, f: Number(f) || 0 })}
          className="flex-1 py-2.5 rounded-xl text-sm font-black disabled:opacity-40"
          style={{ background: C.coral, color: "#1A0E08" }}
        >
          Add & log it
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Food tab                                                            */
/* ------------------------------------------------------------------ */
function FoodTab({ dailyLog, targets, customFoods, onAddFood, onRemoveFood, onAddSteps, onAddCustomFood, onRemoveCustomFood }) {
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(null);
  const [grams, setGrams] = useState("100");
  const [showAddFood, setShowAddFood] = useState(false);

  const mergedResults = useMemo(() => {
    const customTagged = customFoods.map((f) => ({ ...f, isCustom: true }));
    const all = [...customTagged, ...FOOD_DB];
    if (!query.trim()) return all.slice(0, 8);
    const q = query.toLowerCase();
    return all.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 12);
  }, [query, customFoods]);

  const confirmAdd = (food) => {
    const factor = Number(grams || 0) / 100;
    onAddFood({ id: genId(), name: food.name, grams: Number(grams || 0), kcal: Math.round(food.kcal * factor), p: Math.round(food.p * factor * 10) / 10, c: Math.round(food.c * factor * 10) / 10, f: Math.round(food.f * factor * 10) / 10 });
    setPicking(null); setGrams("100"); setQuery("");
  };

  const addCustomAndLog = (foodTotals) => {
    onAddCustomFood(foodTotals);
    onAddFood({ id: genId(), name: foodTotals.name, grams: null, kcal: foodTotals.kcal, p: foodTotals.p, c: foodTotals.c, f: foodTotals.f });
    setShowAddFood(false);
  };

  return (
    <div className="px-5 pt-6 pb-4">
      <SectionLabel eyebrow="FOOD" title="Log what you eat" sub="Search a food, set the amount, and it's added to today's totals." />
      <div className="relative mt-4">
        <Search size={16} color={C.muted} style={{ position: "absolute", left: 14, top: 14 }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods — e.g. chicken, oats, banana" className="w-full rounded-2xl pl-10 pr-4 py-3.5 text-sm outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
      </div>

      <div className="mt-3">
        {showAddFood ? (
          <AddFoodForm onCancel={() => setShowAddFood(false)} onSubmit={addCustomAndLog} />
        ) : (
          <button onClick={() => setShowAddFood(true)} className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2" style={{ background: C.surface, color: C.cream, border: `1px dashed ${C.border}` }}><Plus size={16} color={C.amber} /> Can't find it? Add your own food</button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {mergedResults.map((food) => (
          <div key={food.isCustom ? `custom-${food.name}` : food.name} className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <button
              className="w-full flex items-center justify-between px-4 py-3"
              onClick={() => (food.isCustom ? addCustomAndLog(food) : setPicking(picking === food.name ? null : food.name))}
            >
              <div className="text-left">
                <div className="text-white font-semibold text-sm flex items-center gap-1.5">
                  {food.name}
                  {food.isCustom && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: C.surfaceRaised, color: C.amber }}>YOURS</span>}
                </div>
                <div className="text-xs mt-0.5" style={{ color: C.muted }}>{food.kcal} kcal · {food.p}g protein{food.isCustom ? " · tap to log again" : " / 100g"}</div>
              </div>
              {food.isCustom ? (
                <span onClick={(e) => { e.stopPropagation(); onRemoveCustomFood(food.name); }} className="p-1.5 rounded-full" style={{ background: C.surfaceRaised }}><Trash2 size={13} color={C.danger} /></span>
              ) : (
                <Plus size={18} color={C.coral} />
              )}
            </button>
            {!food.isCustom && picking === food.name && (
              <div className="px-4 pb-3.5 flex items-center gap-2" style={{ borderTop: `1px solid ${C.border}` }}>
                <input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} className="flex-1 rounded-xl px-3 py-2.5 text-sm mt-3 outline-none" style={{ background: C.surfaceRaised, color: C.cream, border: `1px solid ${C.border}` }} />
                <span className="text-sm mt-3" style={{ color: C.muted }}>g</span>
                <button onClick={() => confirmAdd(food)} className="mt-3 px-4 py-2.5 rounded-xl font-bold text-sm" style={{ background: C.coral, color: "#1A0E08" }}>Add</button>
              </div>
            )}
          </div>
        ))}
        {mergedResults.length === 0 && <div className="text-sm text-center py-6" style={{ color: C.muted }}>No matches — try a different search term, or add it as your own food above.</div>}
      </div>

      <div className="mt-6">
        <div className="text-xs font-bold uppercase tracking-wide mb-2 flex justify-between" style={{ color: C.muted }}><span>Steps today</span><span>{dailyLog.steps.toLocaleString()} / {targets.steps.toLocaleString()}</span></div>
        <div className="flex gap-2">
          {[1000, 2500, 5000].map((amt) => <button key={amt} onClick={() => onAddSteps(dailyLog.steps + amt)} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }}>+{amt.toLocaleString()}</button>)}
          <button onClick={() => onAddSteps(0)} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: C.surface, color: C.muted, border: `1px solid ${C.border}` }}>Reset</button>
        </div>
      </div>

      <div className="mt-6">
        <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Logged today ({dailyLog.foodEntries.length})</div>
        {dailyLog.foodEntries.length === 0 ? (
          <div className="text-sm py-4" style={{ color: C.muted }}>Nothing logged yet — search above to add your first item.</div>
        ) : (
          <div className="space-y-2">
            {dailyLog.foodEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div><div className="text-white font-semibold text-sm">{entry.name}</div><div className="text-xs mt-0.5" style={{ color: C.muted }}>{entry.grams ? `${entry.grams}g · ` : ""}{entry.kcal} kcal</div></div>
                <button onClick={() => onRemoveFood(entry.id)} className="p-2 rounded-full" style={{ background: C.surfaceRaised }}><Trash2 size={14} color={C.danger} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Train tab                                                           */
/* ------------------------------------------------------------------ */
function Train({ profile, sessionCounts, customExercises, draftMuscles, onSelectMuscle, onLogCustom }) {
  const [view, setView] = useState("front");
  const [showCustomModal, setShowCustomModal] = useState(false);
  return (
    <div className="px-5 pt-6 pb-4">
      <SectionLabel eyebrow="TRAIN" title="Tap a muscle" sub="Build today's visit by adding each muscle you train, then finish it once at the end." />
      <div className="flex items-center justify-between mt-4">
        <div className="flex rounded-2xl overflow-hidden w-fit" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          {["front", "back"].map((v) => <button key={v} onClick={() => setView(v)} className="px-6 py-2 text-xs font-black uppercase tracking-wide" style={{ background: view === v ? C.coral : "transparent", color: view === v ? "#1A0E08" : C.cream }}>{v}</button>)}
        </div>
        <button onClick={() => setShowCustomModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold" style={{ background: C.surface, color: C.amber, border: `1px dashed ${C.border}` }}><Plus size={14} /> Custom</button>
      </div>
      <div className="mt-2 flex justify-center rounded-3xl py-2" style={{ background: `radial-gradient(ellipse at center, ${C.surface}, ${C.bg})` }}>
        <BodyDiagram view={view} gender={profile.gender} onSelect={onSelectMuscle} />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {MUSCLES.map((m) => {
          const added = draftMuscles.includes(m.id);
          return (
            <button key={m.id} onClick={() => onSelectMuscle(m.id)} className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl" style={{ background: added ? C.surfaceRaised : C.surface, border: `1px solid ${added ? C.coral : C.border}` }}>
              <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                {added && <Check size={13} color={C.coral} />}
                {m.name}
              </span>
              {sessionCounts[m.id]?.count > 0 && <span className="text-xs font-black px-1.5 py-0.5 rounded-md" style={{ background: C.surfaceRaised, color: C.cyan }}>{sessionCounts[m.id].count}×</span>}
            </button>
          );
        })}
      </div>
      {showCustomModal && <CustomWorkoutModal onClose={() => setShowCustomModal(false)} onSubmit={(label) => { onLogCustom(label); setShowCustomModal(false); }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress tab (Me / Leaderboard)                                     */
/* ------------------------------------------------------------------ */
function Progress({ profile, weightLog, sessionLog, sessionCounts, onAddWeight, userId, friendCodes, onAddFriend, onRemoveFriend, onPostStatus }) {
  const [sub, setSub] = useState("me");
  const [newWeight, setNewWeight] = useState("");
  const [friendInput, setFriendInput] = useState("");
  const [statusInput, setStatusInput] = useState(profile.status || "");
  const [board, setBoard] = useState({ loading: true, entries: [], error: null });
  const [showFriendsOnly, setShowFriendsOnly] = useState(false);

  const chartData = weightLog.map((w) => ({ date: w.date.slice(5), weight: w.weightKg }));
  const customCount = sessionLog.filter((s) => !s.muscleIds || s.muscleIds.length === 0).length;
  const sortedMuscles = Object.entries(sessionCounts).filter(([, v]) => v.count > 0).sort((a, b) => b[1].count - a[1].count);
  const recentSessions = [...sessionLog].reverse().slice(0, 5);

  const loadBoard = useCallback(async () => {
    setBoard((b) => ({ ...b, loading: true, error: null }));
    try {
      const entries = await fetchLeaderboard();
      setBoard({ loading: false, entries, error: null });
    } catch (e) {
      setBoard({ loading: false, entries: [], error: "Couldn't load the leaderboard right now. Check the Supabase setup in README.md." });
    }
  }, []);

  useEffect(() => { if (sub === "leaderboard") loadBoard(); }, [sub, loadBoard]);

  const visibleEntries = showFriendsOnly ? board.entries.filter((e) => e.id === userId || friendCodes.includes(e.id)) : board.entries;

  return (
    <div className="px-5 pt-6 pb-4">
      <SectionLabel eyebrow="PROGRESS" title="Your trend" />
      <div className="flex mt-4 rounded-2xl overflow-hidden w-fit" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        {[{ id: "me", label: "Me" }, { id: "leaderboard", label: "Leaderboard" }].map((s) => <button key={s.id} onClick={() => setSub(s.id)} className="px-5 py-2 text-xs font-black uppercase tracking-wide" style={{ background: sub === s.id ? C.coral : "transparent", color: sub === s.id ? "#1A0E08" : C.cream }}>{s.label}</button>)}
      </div>

      {sub === "me" && (
        <>
          <div className="rounded-2xl p-4 mt-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}><Scale size={13} color={C.cyan} /> Weight</div>
            {chartData.length >= 2 ? (
              <div style={{ width: "100%", height: 160 }} className="mt-2">
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke={C.muted} fontSize={10} />
                    <YAxis stroke={C.muted} fontSize={10} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ background: C.surfaceRaised, border: "none", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="weight" stroke={C.coral} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="text-sm mt-3" style={{ color: C.muted }}>Log at least two weigh-ins to see your trend line.</div>}
            <div className="flex gap-2 mt-3">
              <input type="number" placeholder="Weight today (kg)" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: C.surfaceRaised, color: C.cream, border: `1px solid ${C.border}` }} />
              <button onClick={() => { if (newWeight && Number(newWeight) > 0) { onAddWeight(Number(newWeight)); setNewWeight(""); } }} className="px-4 rounded-xl" style={{ background: C.coral }}><Plus size={18} color="#1A0E08" /></button>
            </div>
          </div>
          <div className="rounded-2xl p-4 mt-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}><Dumbbell size={13} color={C.coral} /> Workout history</div>
            <div className="text-2xl font-black text-white mt-1">{sessionLog.length}</div>
            <div className="text-xs" style={{ color: C.muted }}>total workouts logged{customCount > 0 ? ` · ${customCount} custom` : ""}</div>
            {sortedMuscles.length > 0 && (
              <div className="mt-3 space-y-2">
                {sortedMuscles.map(([id, v]) => <div key={id} className="flex justify-between items-center text-sm"><span className="text-white">{MUSCLE_MAP[id]?.name || id}</span><span className="font-semibold" style={{ color: C.cyan }}>{v.count}× · last {v.lastDate}</span></div>)}
              </div>
            )}
          </div>

          {recentSessions.length > 0 && (
            <div className="rounded-2xl p-4 mt-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>Recent visits</div>
              <div className="mt-2 space-y-2">
                {recentSessions.map((s) => (
                  <div key={s.id} className="flex justify-between items-center text-sm">
                    <div><div className="text-white font-semibold">{s.label}</div><div className="text-xs" style={{ color: C.muted }}>{s.date}</div></div>
                    <span className="font-black flex items-center gap-1 shrink-0" style={{ color: C.amber }}><Zap size={12} /> {s.xp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sub === "leaderboard" && (
        <>
          <div className="rounded-2xl p-4 mt-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>Your code</div>
            <div className="flex items-center gap-2 mt-2">
              <input readOnly value={userId} className="flex-1 rounded-xl px-3 py-2 text-sm font-mono outline-none" style={{ background: C.surfaceRaised, color: C.cream, border: `1px solid ${C.border}` }} />
              <button onClick={async () => { try { await navigator.clipboard.writeText(userId); } catch (e) { /* select manually if this fails */ } }} className="p-2.5 rounded-xl" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}><Copy size={14} color={C.cream} /></button>
            </div>
            <p className="text-xs mt-2 leading-snug" style={{ color: C.muted }}>Share this so others can add you as a friend. Heads up — the leaderboard, your name, your photo and your status below are all visible to anyone using this app, not just friends. There's no private messaging here.</p>
          </div>

          <div className="rounded-2xl p-4 mt-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>Your public status</div>
            <div className="flex gap-2 mt-2">
              <input value={statusInput} onChange={(e) => setStatusInput(e.target.value)} maxLength={60} placeholder="e.g. Just hit a new bench PB" className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: C.surfaceRaised, color: C.cream, border: `1px solid ${C.border}` }} />
              <button onClick={() => onPostStatus(statusInput)} className="px-4 rounded-xl font-bold text-sm" style={{ background: C.coral, color: "#1A0E08" }}>Post</button>
            </div>
          </div>

          <div className="rounded-2xl p-4 mt-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}><UserPlus size={13} color={C.amber} /> Add a friend by code</div>
            <div className="flex gap-2 mt-2">
              <input value={friendInput} onChange={(e) => setFriendInput(e.target.value)} placeholder="Paste their code" className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none" style={{ background: C.surfaceRaised, color: C.cream, border: `1px solid ${C.border}` }} />
              <button onClick={() => { if (friendInput.trim()) { onAddFriend(friendInput.trim()); setFriendInput(""); } }} className="px-4 rounded-xl font-bold text-sm" style={{ background: C.coral, color: "#1A0E08" }}>Add</button>
            </div>
            {friendCodes.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {friendCodes.map((code) => <div key={code} className="flex items-center justify-between text-xs font-mono rounded-lg px-2.5 py-1.5" style={{ background: C.surfaceRaised }}><span style={{ color: C.cream }}>{code}</span><button onClick={() => onRemoveFriend(code)}><X size={12} color={C.muted} /></button></div>)}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}><Trophy size={14} color={C.amber} /> Rankings</div>
            <div className="flex rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <button onClick={() => setShowFriendsOnly(false)} className="px-3 py-1.5 text-xs font-bold" style={{ background: !showFriendsOnly ? C.coral : "transparent", color: !showFriendsOnly ? "#1A0E08" : C.cream }}>Global</button>
              <button onClick={() => setShowFriendsOnly(true)} className="px-3 py-1.5 text-xs font-bold" style={{ background: showFriendsOnly ? C.coral : "transparent", color: showFriendsOnly ? "#1A0E08" : C.cream }}>Friends</button>
            </div>
          </div>

          <div className="mt-2 space-y-2">
            {board.loading && <div className="text-sm py-4" style={{ color: C.muted }}>Loading leaderboard…</div>}
            {board.error && <div className="text-sm py-4" style={{ color: C.danger }}>{board.error}</div>}
            {!board.loading && !board.error && visibleEntries.length === 0 && <div className="text-sm py-4" style={{ color: C.muted }}>{showFriendsOnly ? "No friends added yet." : "No one's logged a workout yet — be the first."}</div>}
            {visibleEntries.map((entry, i) => (
              <div key={entry.id} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: entry.id === userId ? C.surfaceRaised : C.surface, border: `1px solid ${entry.id === userId ? C.coral : C.border}` }}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black w-5 text-center" style={{ color: C.muted }}>{i + 1}</span>
                  <Avatar photo={entry.photo} name={entry.name} size={34} />
                  <div>
                    <div className="text-white font-bold text-sm">{entry.name || "Anonymous"}{entry.id === userId ? " (you)" : ""}</div>
                    <div className="text-xs" style={{ color: C.muted }}>Level {entry.level} · {entry.workouts} workouts</div>
                    {entry.status && <div className="text-xs italic mt-0.5" style={{ color: C.cyan }}>"{entry.status}"</div>}
                  </div>
                </div>
                <div className="text-sm font-black flex items-center gap-1 shrink-0" style={{ color: C.amber }}><Zap size={13} /> {entry.xp}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile tab                                                         */
/* ------------------------------------------------------------------ */
function ProfileTab({ profile, onUpdate }) {
  const [form, setForm] = useState(profile);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => setForm(profile), [profile]);
  const dirty = JSON.stringify(form) !== JSON.stringify(profile);

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 220);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch (err) {
      /* ignore — upload best effort */
    }
    setUploading(false);
  };

  const numField = (label, key) => (
    <div className="mb-4">
      <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>{label}</div>
      <input type="number" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="w-full rounded-2xl px-4 py-3 text-base font-bold outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
    </div>
  );

  return (
    <div className="px-5 pt-6 pb-4">
      <SectionLabel eyebrow="PROFILE" title="Your details" />

      <div className="flex items-center gap-4 mt-5 mb-2 rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <Avatar photo={form.photo} name={form.displayName} size={64} />
        <div className="flex-1">
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold" style={{ background: C.surfaceRaised, color: C.cream, border: `1px solid ${C.border}` }}>
            <Camera size={14} color={C.amber} /> {uploading ? "Uploading…" : form.photo ? "Change photo" : "Add profile photo"}
          </button>
          {form.photo && <button onClick={() => setForm((f) => ({ ...f, photo: null }))} className="text-xs mt-2 block" style={{ color: C.muted }}>Remove photo</button>}
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        </div>
      </div>
      <p className="text-xs mb-4 leading-snug" style={{ color: C.muted }}>Your photo appears on the shared leaderboard alongside your name — anyone using this app can see it.</p>

      <div className="mb-4">
        <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Display name</div>
        <input value={form.displayName || ""} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} maxLength={20} placeholder="Anonymous" className="w-full rounded-2xl px-4 py-3 text-base font-bold outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
      </div>
      <div className="mb-4">
        <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Gender</div>
        <div className="grid grid-cols-2 gap-2">
          {["male", "female"].map((g) => <button key={g} onClick={() => setForm((f) => ({ ...f, gender: g }))} className="py-2.5 rounded-2xl text-sm font-black uppercase" style={{ background: form.gender === g ? C.coral : C.surface, color: form.gender === g ? "#1A0E08" : C.cream, border: `1px solid ${form.gender === g ? C.coral : C.border}` }}>{g}</button>)}
        </div>
      </div>
      {numField("Age (years)", "age")}
      <div className="mb-4">
        <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Height</div>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input type="number" value={form.heightFt} onChange={(e) => setForm((f) => ({ ...f, heightFt: e.target.value }))} className="w-full rounded-2xl px-4 py-3 text-base font-bold outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
            <span className="absolute right-4 top-3.5 text-sm" style={{ color: C.muted }}>ft</span>
          </div>
          <div className="flex-1 relative">
            <input type="number" value={form.heightIn} onChange={(e) => setForm((f) => ({ ...f, heightIn: e.target.value }))} className="w-full rounded-2xl px-4 py-3 text-base font-bold outline-none" style={{ background: C.surface, color: C.cream, border: `1px solid ${C.border}` }} />
            <span className="absolute right-4 top-3.5 text-sm" style={{ color: C.muted }}>in</span>
          </div>
        </div>
      </div>
      {numField("Weight (kg)", "weightKg")}
      <div className="mb-4">
        <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Activity level</div>
        <div className="space-y-2">
          {Object.entries(ACTIVITY).map(([key, a]) => <button key={key} onClick={() => setForm((f) => ({ ...f, activity: key }))} className="w-full text-left px-4 py-2.5 rounded-2xl text-sm font-semibold" style={{ background: form.activity === key ? C.coral : C.surface, color: form.activity === key ? "#1A0E08" : C.cream, border: `1px solid ${form.activity === key ? C.coral : C.border}` }}>{a.label}</button>)}
        </div>
      </div>
      <div className="mb-4">
        <div className="text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: C.muted }}>Goal</div>
        <div className="space-y-2">
          {Object.entries(GOALS).map(([key, g]) => <button key={key} onClick={() => setForm((f) => ({ ...f, goal: key }))} className="w-full text-left px-4 py-3 rounded-2xl" style={{ background: form.goal === key ? C.coral : C.surface, color: form.goal === key ? "#1A0E08" : C.cream, border: `1px solid ${form.goal === key ? C.coral : C.border}` }}><div className="text-sm font-black">{g.label}</div></button>)}
        </div>
      </div>
      <button disabled={!dirty} onClick={() => onUpdate({ ...form, age: Number(form.age), heightFt: Number(form.heightFt), heightIn: Number(form.heightIn), weightKg: Number(form.weightKg) })} className="w-full py-3.5 rounded-2xl font-black uppercase text-sm disabled:opacity-40" style={{ background: C.coral, color: "#1A0E08" }}>Save changes</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Root app                                                            */
/* ------------------------------------------------------------------ */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState(null);
  const [weightLog, setWeightLog] = useState([]);
  const [sessionLog, setSessionLog] = useState([]);
  const [customExercises, setCustomExercises] = useState({});
  const [customFoods, setCustomFoods] = useState([]);
  const [friendCodes, setFriendCodes] = useState([]);
  const [userId, setUserId] = useState(null);
  const [dailyLog, setDailyLog] = useState({ steps: 0, foodEntries: [] });
  const [tab, setTab] = useState("dashboard");
  const [activeSheet, setActiveSheet] = useState(null);
  const [levelUpMsg, setLevelUpMsg] = useState(null);
  const [draftMuscles, setDraftMuscles] = useState([]);

  useEffect(() => {
    (async () => {
      const p = await loadKey("profile", null);
      const w = await loadKey("weight-log", []);
      const sl = await loadKey("session-log", []);
      const ce = await loadKey("custom-exercises", {});
      const cf = await loadKey("custom-foods", []);
      const fc = await loadKey("friend-codes", []);
      const dm = await loadKey("draft-workout", []);
      let uid = await loadKey("user-id", null);
      if (!uid) { uid = genId(); await saveKey("user-id", uid); }
      const dl = await loadKey(`daily-log-v2:${todayStr()}`, { steps: 0, foodEntries: [] });
      setProfile(p); setWeightLog(w); setSessionLog(sl); setCustomExercises(ce); setCustomFoods(cf); setFriendCodes(fc); setUserId(uid); setDailyLog(dl); setDraftMuscles(dm);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (levelUpMsg) { const t = setTimeout(() => setLevelUpMsg(null), 3200); return () => clearTimeout(t); }
  }, [levelUpMsg]);

  const persistDaily = (next) => saveKey(`daily-log-v2:${todayStr()}`, next);
  const pushLeaderboard = useCallback((uid, entry) => { pushLeaderboardEntry(uid, entry); }, []);

  const handleOnboardingComplete = useCallback((p) => {
    setProfile(p); saveKey("profile", p);
    if (userId) pushLeaderboard(userId, { name: p.displayName || "Anonymous", xp: p.xp || 0, level: levelFromXp(p.xp || 0), workouts: 0, photo: p.photo || null, status: p.status || "", updated: todayStr() });
  }, [userId, pushLeaderboard]);

  const handleProfileUpdate = useCallback((p) => {
    setProfile(p); saveKey("profile", p);
    if (userId) pushLeaderboard(userId, { name: p.displayName || "Anonymous", xp: p.xp || 0, level: levelFromXp(p.xp || 0), workouts: sessionLog.length, photo: p.photo || null, status: p.status || "", updated: todayStr() });
  }, [userId, sessionLog.length, pushLeaderboard]);

  const handlePostStatus = useCallback((status) => {
    setProfile((prev) => {
      const next = { ...prev, status };
      saveKey("profile", next);
      if (userId) pushLeaderboard(userId, { name: next.displayName || "Anonymous", xp: next.xp || 0, level: levelFromXp(next.xp || 0), workouts: sessionLog.length, photo: next.photo || null, status, updated: todayStr() });
      return next;
    });
  }, [userId, sessionLog.length, pushLeaderboard]);

  const handleAddSteps = useCallback((steps) => { setDailyLog((prev) => { const next = { ...prev, steps: Math.max(0, steps) }; persistDaily(next); return next; }); }, []);
  const handleAddFood = useCallback((entry) => { setDailyLog((prev) => { const next = { ...prev, foodEntries: [...prev.foodEntries, entry] }; persistDaily(next); return next; }); }, []);
  const handleRemoveFood = useCallback((id) => { setDailyLog((prev) => { const next = { ...prev, foodEntries: prev.foodEntries.filter((e) => e.id !== id) }; persistDaily(next); return next; }); }, []);
  const handleAddWeight = useCallback((weightKg) => {
    setWeightLog((prev) => { const next = [...prev, { date: todayStr(), weightKg }]; saveKey("weight-log", next); return next; });
    setProfile((prev) => { const next = { ...prev, weightKg }; saveKey("profile", next); return next; });
  }, []);

  const handleAddCustomExercise = useCallback((muscleId, ex) => { setCustomExercises((prev) => { const list = prev[muscleId] || []; const next = { ...prev, [muscleId]: [...list, { ...ex, id: genId() }] }; saveKey("custom-exercises", next); return next; }); }, []);
  const handleRemoveCustomExercise = useCallback((muscleId, exId) => { setCustomExercises((prev) => { const next = { ...prev, [muscleId]: (prev[muscleId] || []).filter((e) => e.id !== exId) }; saveKey("custom-exercises", next); return next; }); }, []);

  const handleAddCustomFood = useCallback((food) => {
    setCustomFoods((prev) => {
      if (prev.some((f) => f.name.toLowerCase() === food.name.toLowerCase())) return prev;
      const next = [...prev, food];
      saveKey("custom-foods", next);
      return next;
    });
  }, []);
  const handleRemoveCustomFood = useCallback((name) => { setCustomFoods((prev) => { const next = prev.filter((f) => f.name !== name); saveKey("custom-foods", next); return next; }); }, []);

  const handleAddFriend = useCallback((code) => { setFriendCodes((prev) => { if (prev.includes(code)) return prev; const next = [...prev, code]; saveKey("friend-codes", next); return next; }); }, []);
  const handleRemoveFriend = useCallback((code) => { setFriendCodes((prev) => { const next = prev.filter((c) => c !== code); saveKey("friend-codes", next); return next; }); }, []);

  const logSession = useCallback((muscleIds, label) => {
    const isFirstToday = !sessionLog.some((s) => s.date === todayStr());
    const xpGain = XP_PER_SESSION + (isFirstToday ? XP_DAILY_BONUS : 0);
    const names = muscleIds.map((id) => MUSCLE_MAP[id]?.name).filter(Boolean);
    const entry = { id: genId(), muscleIds, label: label || (names.length ? names.join(", ") : "Workout"), date: todayStr(), xp: xpGain };
    const nextLog = [...sessionLog, entry];
    setSessionLog(nextLog);
    saveKey("session-log", nextLog);
    setProfile((prev) => {
      const oldXp = prev.xp || 0;
      const newXp = oldXp + xpGain;
      const oldLevel = levelFromXp(oldXp);
      const newLevel = levelFromXp(newXp);
      const nextProfile = { ...prev, xp: newXp };
      saveKey("profile", nextProfile);
      if (newLevel > oldLevel) setLevelUpMsg(`Level up! You're now level ${newLevel}.`);
      if (userId) pushLeaderboard(userId, { name: nextProfile.displayName || "Anonymous", xp: newXp, level: newLevel, workouts: nextLog.length, photo: nextProfile.photo || null, status: nextProfile.status || "", updated: todayStr() });
      return nextProfile;
    });
  }, [sessionLog, userId, pushLeaderboard]);

  const handleToggleDraft = useCallback((muscleId) => {
    setDraftMuscles((prev) => {
      const next = prev.includes(muscleId) ? prev.filter((id) => id !== muscleId) : [...prev, muscleId];
      saveKey("draft-workout", next);
      return next;
    });
    setActiveSheet(null);
  }, []);

  const handleFinishWorkout = useCallback(() => {
    if (draftMuscles.length === 0) return;
    logSession(draftMuscles, null);
    setDraftMuscles([]);
    saveKey("draft-workout", []);
  }, [draftMuscles, logSession]);

  const handleDiscardWorkout = useCallback(() => {
    setDraftMuscles([]);
    saveKey("draft-workout", []);
  }, []);

  const handleLogCustom = useCallback((label) => { logSession([], label); }, [logSession]);

  if (!loaded) return <div className="flex items-center justify-center h-full" style={{ background: C.bg }}><div style={{ color: C.muted }}>Loading…</div></div>;
  if (!profile) return <div style={{ height: "100vh", maxHeight: 900 }}><Onboarding onComplete={handleOnboardingComplete} /></div>;

  const targets = calcTargets(profile);
  const macros = dailyLog.foodEntries.reduce((acc, e) => ({ p: acc.p + (e.p || 0), c: acc.c + (e.c || 0), f: acc.f + (e.f || 0) }), { p: 0, c: 0, f: 0 });
  const caloriesTotal = dailyLog.foodEntries.reduce((sum, e) => sum + e.kcal, 0);
  const dailyLogView = { ...dailyLog, caloriesTotal };
  const roundedMacros = { p: Math.round(macros.p), c: Math.round(macros.c), f: Math.round(macros.f) };
  const sessionCounts = sessionLog.reduce((acc, s) => {
    (s.muscleIds || []).forEach((id) => {
      const cur = acc[id] || { count: 0, lastDate: null };
      acc[id] = { count: cur.count + 1, lastDate: s.date };
    });
    return acc;
  }, {});

  const tabs = [
    { id: "dashboard", label: "Today", icon: Flame },
    { id: "train", label: "Train", icon: Dumbbell },
    { id: "food", label: "Food", icon: UtensilsCrossed },
    { id: "progress", label: "Progress", icon: TrendingUp },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <div className="flex flex-col mx-auto relative" style={{ background: C.bg, height: "100vh", maxHeight: 900, maxWidth: 480, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="flex items-center justify-between px-5 pt-5 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.amber})` }}><Dumbbell size={16} color="#1A0E08" /></div>
          <span className="text-white font-black uppercase tracking-tight text-lg">LockIn</span>
        </div>
        <div className="flex items-center gap-2.5">
          <LevelBadge xp={profile.xp || 0} compact />
          <button onClick={() => setTab("profile")}><Avatar photo={profile.photo} name={profile.displayName} size={30} /></button>
        </div>
      </div>

      {levelUpMsg && (
        <div className="absolute top-16 left-5 right-5 z-40 rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg" style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.amber})`, color: "#1A0E08" }}><Sparkles size={18} /> <span className="font-black text-sm">{levelUpMsg}</span></div>
      )}

      <div className="flex-1 overflow-y-auto">
        {tab === "dashboard" && <Dashboard targets={targets} dailyLog={dailyLogView} macros={roundedMacros} onGoFood={() => setTab("food")} />}
        {tab === "train" && <Train profile={profile} sessionCounts={sessionCounts} customExercises={customExercises} draftMuscles={draftMuscles} onSelectMuscle={(id) => setActiveSheet(id)} onLogCustom={handleLogCustom} />}
        {tab === "food" && <FoodTab dailyLog={dailyLog} targets={targets} customFoods={customFoods} onAddFood={handleAddFood} onRemoveFood={handleRemoveFood} onAddSteps={handleAddSteps} onAddCustomFood={handleAddCustomFood} onRemoveCustomFood={handleRemoveCustomFood} />}
        {tab === "progress" && <Progress profile={profile} weightLog={weightLog} sessionLog={sessionLog} sessionCounts={sessionCounts} onAddWeight={handleAddWeight} userId={userId} friendCodes={friendCodes} onAddFriend={handleAddFriend} onRemoveFriend={handleRemoveFriend} onPostStatus={handlePostStatus} />}
        {tab === "profile" && <ProfileTab profile={profile} onUpdate={handleProfileUpdate} />}
      </div>

      {draftMuscles.length > 0 && (
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: C.surfaceRaised, borderTop: `1px solid ${C.border}` }}>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: C.amber }}>Today's visit · {draftMuscles.length} muscle{draftMuscles.length === 1 ? "" : "s"}</div>
            <div className="text-sm font-semibold text-white truncate">{draftMuscles.map((id) => MUSCLE_MAP[id]?.name).join(", ")}</div>
          </div>
          <button onClick={handleDiscardWorkout} className="p-2 rounded-full shrink-0" style={{ background: C.surface }}><X size={15} color={C.muted} /></button>
          <button onClick={handleFinishWorkout} className="px-4 py-2.5 rounded-xl font-black text-xs uppercase shrink-0" style={{ background: C.coral, color: "#1A0E08" }}>Finish visit</button>
        </div>
      )}

      <div className="flex" style={{ borderTop: `1px solid ${C.border}`, background: C.bg }}>
        {tabs.map((t) => {
          const Icon = t.icon; const active = tab === t.id;
          return <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 flex flex-col items-center gap-1 py-2.5"><Icon size={19} color={active ? C.coral : C.muted} /><span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: active ? C.coral : C.muted }}>{t.label}</span></button>;
        })}
      </div>

      {activeSheet && <MuscleSheet muscleId={activeSheet} profile={profile} sessionCounts={sessionCounts} customExercises={customExercises} inDraft={draftMuscles.includes(activeSheet)} onClose={() => setActiveSheet(null)} onToggleDraft={handleToggleDraft} onAddCustom={handleAddCustomExercise} onRemoveCustom={handleRemoveCustomExercise} />}
    </div>
  );
}
