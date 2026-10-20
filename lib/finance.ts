export const STORAGE_KEY = "qarjy.finance.v1";
export const MAX_MONEY = 100_000_000_000;

export const categories = {
  income: ["Жалақы", "Қосымша табыс", "Сыйлық", "Басқа кіріс"],
  expense: ["Азық-түлік", "Тұрғын үй", "Көлік", "Денсаулық", "Білім", "Демалыс", "Басқа шығыс"],
} as const;

export type Transaction = {
  id: string;
  type: "income" | "expense";
  title: string;
  amount: number; // Ақша бүтін тиынмен сақталады.
  category: string;
  date: string;
};
export type Goal = { id: string; title: string; target: number; saved: number; deadline: string };
export type Budget = { income: string; housing: string; food: string; transport: string; other: string };
export type FinanceData = {
  version: 1;
  transactions: Transaction[];
  goals: Goal[];
  completedLessons: string[];
  theme: "light" | "dark";
  budget: Budget;
};

export const emptyData: FinanceData = {
  version: 1, transactions: [], goals: [], completedLessons: [], theme: "light",
  budget: { income: "", housing: "", food: "", transport: "", other: "" },
};

export function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount <= MAX_MONEY ? amount : null;
}

export function money(amount: number) {
  const absolute = Math.abs(amount);
  const whole = String(Math.floor(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  const fraction = absolute % 100;
  return `${amount < 0 ? "−" : ""}${whole}${fraction ? `,${String(fraction).padStart(2, "0")}` : ""} ₸`;
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function displayDate(value: string, full = false) {
  if (!validDate(value)) return "—";
  return new Intl.DateTimeFormat("kk-KZ", { day: "numeric", month: full ? "long" : "short", ...(full ? { year: "numeric" } : {}) }).format(new Date(`${value}T12:00:00`));
}

export function totals(transactions: Transaction[]) {
  const income = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  return { income, expense, balance: income - expense };
}

export function goalProgress(goal: Goal) {
  return Math.min(100, Math.floor((goal.saved / goal.target) * 100));
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 80): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const amount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_MONEY;

export function readData(raw: string): FinanceData | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || !["light", "dark"].includes(String(value.theme))) return null;
    if (!Array.isArray(value.transactions) || !Array.isArray(value.goals) || !Array.isArray(value.completedLessons)) return null;
    if (value.transactions.length > 10000 || value.goals.length > 100 || value.completedLessons.length > 20) return null;
    if (!value.transactions.every((t: unknown) => record(t) && text(t.id, 100) && text(t.title) && amount(t.amount) && t.amount > 0 && validDate(t.date) && (t.type === "income" || t.type === "expense") && categories[t.type].some((c) => c === t.category))) return null;
    if (!value.goals.every((g: unknown) => record(g) && text(g.id, 100) && text(g.title) && amount(g.target) && g.target > 0 && amount(g.saved) && g.saved <= g.target && (g.deadline === "" || validDate(g.deadline)))) return null;
    if (!value.completedLessons.every((id: unknown) => typeof id === "string" && /^lesson-[1-6]$/.test(id)) || new Set(value.completedLessons).size !== value.completedLessons.length) return null;
    if (!record(value.budget) || !Object.keys(emptyData.budget).every((key) => record(value.budget) && typeof value.budget[key] === "string" && (value.budget[key] === "" || parseMoney(value.budget[key]) !== null))) return null;
    if (new Set(value.transactions.map((t) => t.id)).size !== value.transactions.length || new Set(value.goals.map((g) => g.id)).size !== value.goals.length) return null;
    return value as FinanceData;
  } catch { return null; }
}

export const lessons = [
  { id: "lesson-1", title: "Жеке бюджет неден басталады?", category: "Бюджет негіздері", duration: "3 минут", icon: "wallet", color: "mint", description: "Кіріс пен шығысты түсініп, ақшаңызды жоспарлаңыз.", paragraphs: ["Жеке бюджет — белгілі бір кезеңдегі кірістеріңіз бен шығыстарыңыздың жоспары. Кіріс — сізге түскен ақша, ал шығыс — жұмсаған ақшаңыз.", "Алдымен бір айдағы барлық кіріс пен шығысты жазыңыз. Шығыстарды азық-түлік, тұрғын үй, көлік сияқты санаттарға бөліңіз. Осылайша ақшаңыздың қайда кеткенін көресіз.", "Мысалы, 300 000 ₸ кіріс пен 230 000 ₸ шығыс болса, айырма 70 000 ₸ болады. Бұл соманы келесі айға қалдыруға немесе мақсатыңызға бөлуге болады."], question: "Кіріс 300 000 ₸, шығыс 230 000 ₸. Қалдық қанша?", answers: ["30 000 ₸", "70 000 ₸", "530 000 ₸"], correct: 1 },
  { id: "lesson-2", title: "50 / 30 / 20 қағидасы", category: "Ақылды жоспар", duration: "4 минут", icon: "chart", color: "peach", description: "Ақша бөлудің қарапайым үлгісімен танысыңыз.", paragraphs: ["50/30/20 — бюджетті бөлудің мысал үлгісі: кірістің 50%-ы қажеттіліктерге, 30%-ы қалауларға, 20%-ы жинақ пен қарыз міндеттемелеріне бөлінеді.", "Мысалы, 300 000 ₸ кірісте бұл 150 000 ₸, 90 000 ₸ және 60 000 ₸ болады. Бюджет калькуляторында өз сомаңызбен есептеп көріңіз.", "Бұл міндетті ереже емес. Тұрғын үй ақысы, отбасы жағдайы мен міндеттемелерге қарай үлестерді өзгертіңіз. Ең бастысы — өзіңізге орындалатын жоспар құру."], question: "300 000 ₸ соманың 20%-ы қанша?", answers: ["60 000 ₸", "90 000 ₸", "150 000 ₸"], correct: 0 },
  { id: "lesson-3", title: "Жинақ мақсатын қалай қоямыз?", category: "Жинақ әдеті", duration: "3 минут", icon: "target", color: "lilac", description: "Арманыңызды нақты сома мен жоспарға айналдырыңыз.", paragraphs: ["Нақты мақсатқа ақша жинау оңайырақ: не үшін, қанша және қай уақытқа дейін жинайтыныңызды жазыңыз.", "Мысалы, ноутбукке 240 000 ₸ қажет, ал қолыңызда 60 000 ₸ бар. Қалған 180 000 ₸ соманы 6 айда жинау үшін айына 30 000 ₸ бөліп отыру керек.", "Жинақ мақсаттары бөлімінде мақсат құрып, әр қосқан сомаңызды белгілеңіз. Бұл тек жинақ есебі: белгіленген ақша банк шотына аударылмайды және баланстан автоматты шегерілмейді."], question: "180 000 ₸ соманы 6 айда жинау үшін айына қанша қажет?", answers: ["15 000 ₸", "20 000 ₸", "30 000 ₸"], correct: 2 },
  { id: "lesson-4", title: "Қаржылық қауіпсіздік қоры", category: "Сенімді болашақ", duration: "3 минут", icon: "shield", color: "butter", description: "Күтпеген шығынға алдын ала дайын болыңыз.", paragraphs: ["Күтпеген жөндеу, денсаулыққа кететін шығын немесе кірістің уақытша азаюы жоспарға әсер етеді. Қаржылық қор осындай жағдайларға дайындалуға көмектеседі.", "Қорға қажет соманы өзіңіздің негізгі айлық шығыныңыз бен жағдайыңызға қарай анықтаңыз. Аз сомадан бастап, тұрақты толықтыруға ыңғайлы жоспар жасаңыз.", "Күнделікті шығын мен қорды есепте бөлек ұстау пайдалы. Қордың мақсаты — күтпеген қажеттілікке қолжетімді қаражат сақтау."], question: "Қауіпсіздік қорының негізгі мақсаты қандай?", answers: ["Күтпеген қажеттіліктерге дайын болу", "Барлық ақшаны бірден жұмсау", "Тек демалысқа ақша жинау"], correct: 0 },
  { id: "lesson-5", title: "Қажеттілік пе, әлде қалау ма?", category: "Саналы тұтыну", duration: "2 минут", icon: "bag", color: "peach", description: "Сатып алар алдында өзіңізге дұрыс сұрақ қойыңыз.", paragraphs: ["Қажеттілік — күнделікті өміріңізге қажет шығын: азық-түлік, тұрғын үй, дәрі-дәрмек. Қалау — өмірді жағымды ететін, бірақ кейінге қалдыруға болатын сатып алу.", "Шекара әр адамда әртүрлі. Мысалы, жұмысқа қажет интернет — қажеттілік, ал пайдаланылмайтын қосымша жазылым — қайта қарауға болатын шығын.", "Ірі сатып алудың алдында бағасын, бюджетке әсерін және баламаларын салыстырыңыз. Асықпай шешім қабылдау жоспарсыз шығынды азайтуы мүмкін."], question: "Шығыстарды санаттарға бөлу не үшін қажет?", answers: ["Тек түбіртектерді көбейту үшін", "Ақшаның қайда кететінін түсіну үшін", "Кірісті автоматты арттыру үшін"], correct: 1 },
  { id: "lesson-6", title: "Ақшаңызды алаяқтардан қорғаңыз", category: "Қаржылық қауіпсіздік", duration: "4 минут", icon: "lock", color: "mint", description: "Жеке деректерді қорғаудың негізгі қадамдары.", paragraphs: ["Картаңыздың PIN-кодын, CVV/CVC кодын және SMS арқылы келген бір реттік кодтарды басқа адамға айтпаңыз. Күмәнді сілтеме арқылы банкке кіруге асықпаңыз.", "Банк атынан шұғыл ақша аударуды сұраса, әңгімені тоқтатып, банктің ресми қосымшасы немесе картада көрсетілген нөмір арқылы өзіңіз хабарласыңыз.", "Кепілді әрі өте жоғары табыс уәде етілсе, шешімді асықпай тексеріңіз. Ұйым туралы ақпаратты ресми дереккөздерден іздеңіз."], question: "Бейтаныс адам SMS-кодты сұраса, не істейсіз?", answers: ["Кодты бірден айтамын", "Хабарламаны жіберемін", "Кодты бермей, банктің ресми арнасына хабарласамын"], correct: 2 },
] as const;
