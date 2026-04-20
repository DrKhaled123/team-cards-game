/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Timer, 
  Brain, 
  Shield, 
  Zap, 
  Sword, 
  Star,
  RotateCcw,
  BookOpen,
  Atom,
  Dna,
  Calculator,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

// --- Types ---

type Subject = 'اللغة العربية' | 'الأحياء' | 'الكيمياء' | 'الفيزياء' | 'الرياضيات';
type Difficulty = 'سهل' | 'متوسط' | 'متوسط-صعب' | 'صعب-جدا';
type SpecialPower = 
  | 'REVENGE'      // H1: Deduct points from prev opponent + 300 to self
  | 'TRIPLE'       // H2: Triple teammate's next turn
  | 'STEAL_ALL'    // H3: Transfer all points from one opponent
  | 'DOUBLE_STRIKE'// H4: -100 opponent, +200 self, freeze next
  | 'NUKE'         // H5: +500 team, -200 self if wrong, +150 teammate
  | 'DEDUCT_100'   // MH-S1: Deduct 100
  | 'PASS_QUESTION'// MH-S2: Pass to teammate
  | 'STEAL_PASS'   // MH-S3: Steal bonus from opponent pass
  | 'NONE';

interface Question {
  id: number;
  subject: Subject;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Card {
  id: string;
  name: string;
  difficulty: Difficulty;
  special: SpecialPower;
  points: number;
  subject: Subject;
  isArmed?: boolean;
}

interface Player {
  id: number;
  name: string;
  team: 'A' | 'B';
  score: number;
  isTeammateOf: number;
  nextTurnEffect?: 'TRIPLE' | 'FREEZE';
  isAI?: boolean;
}

type AIDifficulty = 'سهل' | 'متوسط' | 'صعب';

const QUESTIONS_BANK: Question[] = [
  // --- Arabic ---
  { id: 1, subject: 'اللغة العربية', text: 'ما إعراب كلمة "الطالب" في جملة: "كان الطالبُ مجتهداً"؟', options: ['مبتدأ', 'اسم كان مرفوع', 'خبر كان منصوب', 'فاعل'], correctIndex: 1, explanation: 'لأن "كان" تدخل على الجملة الاسمية فترفع المبتدأ ويسمى اسمها.' },
  { id: 2, subject: 'اللغة العربية', text: 'أي مما يلي من أخوات "إن"؟', options: ['صار', 'ما زال', 'ليت', 'أصبح'], correctIndex: 2, explanation: '"ليت" من الحروف الناصبة التي تدخل على الجملة الاسمية وهي من أخوات إن.' },
  { id: 3, subject: 'اللغة العربية', text: 'الأسلوب الذي يصوّر المعنى المعقول في صورة محسوسة يسمى:', options: ['الكناية', 'التشبيه', 'المحاز', 'الطباق'], correctIndex: 1, explanation: 'التشبيه هو عقد مقارنة بين شيئين يشتركان في صفة واحدة لإيضاح المعنى.' },
  { id: 4, subject: 'اللغة العربية', text: 'المصدر من الفعل "أكرم" هو:', options: ['كرامة', 'إكرام', 'تكريم', 'استكرام'], correctIndex: 1, explanation: 'أفعلَ مصدرها إفعال، لذا أكرمَ إكرام.' },
  { id: 5, subject: 'اللغة العربية', text: 'في جملة "أكرمتُ الطالبَ المجتهدَ"، كلمة "المجتهدَ" إعرابها:', options: ['فاعل', 'مفعول به', 'نعت', 'حال'], correctIndex: 2, explanation: 'المجتهد تصف الطالب وتتبعه في الإعراب (منصوب) لذا فهي نعت.' },
  { id: 6, subject: 'اللغة العربية', text: 'أي الأفعال الآتية فعل ناقص؟', options: ['كتب', 'أصبح', 'خرج', 'شرب'], correctIndex: 1, explanation: 'الأفعال الناقصة هي كان وأخواتها ومنها "أصبح".' },
  { id: 7, subject: 'اللغة العربية', text: 'الاسم المنقوص مما يلي هو:', options: ['القاضي', 'السماء', 'بناء', 'الصحراء'], correctIndex: 0, explanation: 'الاسم المنقوص هو كل اسم معرب آخره ياء لازمة مكسور ما قبلها.' },
  
  // --- Biology ---
  { id: 101, subject: 'الأحياء', text: 'أي أنواع العضلات التالية لا تخضع للإرادة؟', options: ['العضلات الهيكلية', 'عضلة القلب', 'عضلات الأطراف', 'عضلة الحجاب الحاجز'], correctIndex: 1, explanation: 'عضلة القلب ملساء ولا إرادية في عملها.' },
  { id: 102, subject: 'الأحياء', text: 'الهرمون المسؤول عن تنظيم مستوى الكالسيوم في الدم هو:', options: ['الأنسولين', 'الثيروكسين', 'الباراثورمون', 'الأدرينالين'], correctIndex: 2, explanation: 'يعمل الباراثورمون على رفع مستوى الكالسيوم في الدم عند انخفاضه.' },
  { id: 103, subject: 'الأحياء', text: 'الثمرة تتكون من:', options: ['البويضة بعد الإخصاب', 'جدار المبيض بعد الإخصاب', 'الخامة الزهرية', 'حبة اللقاح'], correctIndex: 1, explanation: 'المبيض ينضج ليتحول إلى ثمرة، بينما البويضة تتحول إلى بذرة.' },
  { id: 104, subject: 'الأحياء', text: 'ما احتمال إصابة أبناء ذكر مصاب بعمى الألوان من أنثى سليمة غير حاملة للمرض؟', options: ['صفر٪', '٢٥٪', '٥٠٪', '١٠٠٪'], correctIndex: 0, explanation: 'بما أن الأم سليمة تماماً (X X)، فالأبناء الذكور جميعاً سيكونون سليمين لأنهم يرثون الـ Y من الأب.' },
  { id: 105, subject: 'الأحياء', text: 'الخلايا المسؤولة عن إنتاج الأجسام المضادة هي:', options: ['الخلايا التائية', 'الخلايا البائية', 'البلاعم', 'خلايا الدم الحمراء'], correctIndex: 1, explanation: 'الخلايا البائية البلازمية هي التي تنتج الأجسام المضادة.' },
  { id: 106, subject: 'الأحياء', text: 'ما احتمال ظهور صفة سائدة عند تزاوج فردين كلاهما هجين؟', options: ['٢٥٪', '٥٠٪', '٧٥٪', '١٠٠٪'], correctIndex: 2, explanation: 'توزيع مندل للفردين الهجينين (Aa x Aa) هو ١ بورت نقي، ٢ هجين (سائد)، ١ متنحي، المجموع ٧٥٪ سائد.' },
  { id: 107, subject: 'الأحياء', text: 'الوحدة الوظيفية للهيكل العظمي في الحركة هي:', options: ['العظمة', 'المفصل', 'العضلة', 'الوتر'], correctIndex: 1, explanation: 'المفصل هو مكان التقاء عظمين ويسمح بالحركة.' },
  
  // --- Physics ---
  { id: 201, subject: 'الفيزياء', text: 'ينص قانون لينز على أن التيار المحثّ دائماً يعاكس:', options: ['اتجاه التيار الأصلي', 'التغير في الفيض المغناطيسي', 'مقاومة الدائرة', 'الجهد الكهربي'], correctIndex: 1, explanation: 'قانون لينز يحقق قانون بقاء الطاقة حيث يعاكس التيار المحث التغير المسبب له.' },
  { id: 202, subject: 'الفيزياء', text: 'وحدة قياس المقاومة النوعية هي:', options: ['أوم', 'أوم.متر', 'أمبير/متر', 'فولت/أمبير'], correctIndex: 1, explanation: 'المقاومة النوعية = R.A/L وتقاس بالأوم.متر.' },
  { id: 203, subject: 'الفيزياء', text: 'الليزر يتميز بكونه ضوءاً:', options: ['متعدد الأطوال الموجية', 'غير متماسك', 'أحادي الطول الموجي ومتماسك', 'منتشراً في جميع الاتجاهات'], correctIndex: 2, explanation: 'تتميز أشعة الليزر بالنقاء الطيفي والترابط (التماسك).' },
  { id: 204, subject: 'الفيزياء', text: 'عند زيادة تردد الضوء الساقط على مهبط خلية كهروضوئية، فإن طاقة حركة الإلكترونات المتحررة:', options: ['تزداد', 'تقل', 'تظل ثابتة', 'تنعدم'], correctIndex: 0, explanation: 'طاقة الحركة تعتمد طردياً على تردد الضوء الساقط (E = hf).' },
  { id: 205, subject: 'الفيزياء', text: 'قاعدة اليد اليمنى لأمبير تستخدم لتحديد اتجاه:', options: ['القوة المغناطيسية', 'المجال المغناطيسي لسلك مستقيم', 'التيار التأثيري', 'عزم الازدواج'], correctIndex: 1, explanation: 'يشر الإبهام للتيار والأصابع لاتجاه المجال المغناطيسي.' },
  { id: 206, subject: 'الفيزياء', text: 'تتكون الدائرة المهتزة من مكثف و:', options: ['مقاومة أومية', 'ملف حس', 'دايود', 'ترانزستور'], correctIndex: 1, explanation: 'تحدث عملية تبادل للطاقة بين المكثف وملف الحث.' },
  { id: 207, subject: 'الفيزياء', text: 'ظاهرة انبعاث الإلكترونات من سطح معدن عند سقوط ضوء عليه تسمى:', options: ['التأثير المغناطيسي', 'التأثير الكهروضوئي', 'الحث الكهرومغناطيسي', 'تأثير كومبتون'], correctIndex: 1, explanation: 'هي الظاهرة الكهروضوئية المفسرة بالنموذج الفوتوني.' },

  // --- Chemistry ---
  { id: 301, subject: 'الكيمياء', text: 'العلاقة بين سرعة التفاعل والتركيز يصفها قانون:', options: ['أفوغادرو', 'فعل الكتلة', 'شارل', 'بويل'], correctIndex: 1, explanation: 'قانون فعل الكتلة لـ "جولدبرج ووايج" يوضح أثر التركيز على السرعة.' },
  { id: 302, subject: 'الكيمياء', text: 'محلول pH له يساوي ٩ يعتبر محلولاً:', options: ['حمضياً قوياً', 'حمضياً ضعيفاً', 'متعادلاً', 'قلوياً'], correctIndex: 3, explanation: 'إذا كان pH أكبر من ٧ فالمحلول قاعدي/قلوي.' },
  { id: 303, subject: 'الكيمياء', text: 'الصيغة العامة للألكانات هي:', options: ['CnH2n', 'CnH2n-2', 'CnH2n+2', 'CnH2n+1'], correctIndex: 2, explanation: 'الألكانات هيدروكربونات مشبعة صيغتها CnH2n+2.' },
  { id: 304, subject: 'الكيمياء', text: 'الألوان في مركبات العناصر الانتقالية تعود إلى:', options: ['امتلاء المدار d', 'عدم امتلاء المدار d', 'عدم وجود إلكترونات', 'حجم النواة'], correctIndex: 1, explanation: 'وجود إلكترونات مفردة في مدار d يسمح لها بامتصاص ألوان معينة.' },
  { id: 305, subject: 'الكيمياء', text: 'تفاعل الإستر ينتج من تفاعل كحول مع:', options: ['أمين', 'إيثر', 'حمض كربوكسيلي', 'ألكين'], correctIndex: 2, explanation: 'حمض عضوي + كحول -> إستر + ماء.' },
  { id: 306, subject: 'الكيمياء', text: 'أقوى العوامل المؤكسدة في السلسلة الكهروكيميائية هو:', options: ['الليثيوم', 'الفلور', 'الهيدروجين', 'الذهب'], correctIndex: 1, explanation: 'الفلور له أعلى جهد اختزال في السلسلة.' },
  { id: 307, subject: 'الكيمياء', text: 'عدد تأكسد المنجنيز في KMnO4 هو:', options: ['+٢', '+٤', '+٦', '+٧'], correctIndex: 3, explanation: 'حاصل جمع أعداد التأكسد = ٠، لذا (+١ + Mn - ٨ = ٠) إذن Mn = +٧.' },
  { id: 308, subject: 'الكيمياء', text: 'يستخدم الكروم في طلاء المعادن بسبب:', options: ['نشاطه الكيميائي الكبير', 'تكون طبقة أكسيد غير مسامية تحميه', 'رخص ثمنه', 'لونه الجذاب'], correctIndex: 1, explanation: 'الخمول الكيميائي للكروم يعود لطبقة الأكسيد الواقية.' },
  { id: 309, subject: 'الكيمياء', text: 'يسمى المركب CH3-CH2-OH بـ:', options: ['ميثانول', 'إيثانول', 'بروبانول', 'فينول'], correctIndex: 1, explanation: 'يحتوي على ذرتي كربون ومجموعة هيدروكسيل فهو إيثانول.' },

  // --- Mathematics ---
  { id: 401, subject: 'الرياضيات', text: 'الحد الثالث في مفكوك (س + ٢)⁵ هو:', options: ['٤٠س³', '٨٠س³', '٤٠س²', '١٦٠س²'], correctIndex: 1, explanation: 'ح٣ = ٥ ق ٢ (س)³ (٢)² = ١٠ * س³ * ٤ = ٤٠س³.' },
  { id: 402, subject: 'الرياضيات', text: 'إذا كان ز = ٣ + ٤ي، فإن مقياس العدد المركب يساوي:', options: ['٣', '٤', '٥', '٧'], correctIndex: 2, explanation: 'المقياس = جذر(٣² + ٤²) = جذر(٢٥) = ٥.' },
  { id: 403, subject: 'الرياضيات', text: 'مشتقة الدالة د(س) = س² + ٥س هي:', options: ['٢س', '٢س+٥', '٥', 'س'], correctIndex: 1, explanation: 'مشتقة س² هي ٢س ومشتقة ٥س هي ٥.' },
  { id: 404, subject: 'الرياضيات', text: 'مجموعة حل المعادلة س² + ١ = ٠ في مجموعة الأعداد المركبة هي:', options: ['{١، -١}', '{ي، -ي}', '{٠}', 'فاي'], correctIndex: 1, explanation: 'س² = -١، إذن س = موجب أو سالب جذر(-١) وهو موجب أو سالب ي.' },
  { id: 405, subject: 'الرياضيات', text: 'تكامل ٢س بالنسبة لـ س هو:', options: ['س²', 'س² + ث', '٢', 'س'], correctIndex: 1, explanation: 'تكامل س^ن هو س^(ن+١)/(ن+١) + ث.' },
  { id: 406, subject: 'الرياضيات', text: 'العدد المركب ت²٤ يساوي:', options: ['١', '-١', 'ت', '-ت'], correctIndex: 0, explanation: 'بما أن ٢٤ تقبل القسمة على ٤ فالباقي صفر، إذن ت^٢٤ = ١.' },
  { id: 407, subject: 'الرياضيات', text: 'نقطة الانقلاب للدالة تحدث عندما:', options: ['المشتقة الأولى تساوي صفر', 'المشتقة الثانية تساوي صفر وتغير إشارتها', 'الدالة معرفة', 'الميل موجب'], correctIndex: 1, explanation: 'نقطة الانقلاب تفصل بين مناطق التحدب للأعلى والأسفل.' },
  { id: 408, subject: 'الرياضيات', text: 'إذا كان المصفوفة أ مربعة، فإن (أ + أ^ت) تكون:', options: ['متماثلة', 'شبه متماثلة', 'صفرية', 'وحدة'], correctIndex: 0, explanation: 'لأن مدور الناتج هو نفسه المصفوفة الأصلية.' },
  { id: 409, subject: 'الرياضيات', text: 'قيمة المحدد |٣ ٠| |٠ ٣| تساوي:', options: ['٠', '٣', '٦', '٩'], correctIndex: 3, explanation: 'قيمة المحدد = ٣*٣ - ٠*٠ = ٩.' },
];

// --- Utilities ---

const getRandomQuestions = (subject: Subject, count: number, excludeIds: number[] = []) => {
  const filtered = QUESTIONS_BANK.filter(q => q.subject === subject && !excludeIds.includes(q.id));
  const shuffled = [...filtered].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const createDeck = (track: 'science' | 'math'): Card[] => {
  const deck: Card[] = [];
  const subjects: Subject[] = track === 'science' 
    ? ['اللغة العربية', 'الأحياء', 'الكيمياء', 'الفيزياء'] 
    : ['اللغة العربية', 'الرياضيات', 'الكيمياء', 'الفيزياء'];

  // Hard Cards (5)
  const hardPowers: SpecialPower[] = ['REVENGE', 'TRIPLE', 'STEAL_ALL', 'DOUBLE_STRIKE', 'NUKE'];
  hardPowers.forEach((p, i) => {
    deck.push({
      id: `H-${i}`,
      name: i === 0 ? 'الخصم الانتقامي' : i === 1 ? 'المضاعف الذهبي' : i === 2 ? 'السارق الكبير' : i === 3 ? 'الضربة المزدوجة' : 'القنبلة النووية',
      difficulty: 'صعب-جدا',
      special: p,
      points: 300,
      subject: subjects[i % subjects.length],
      isArmed: i >= 3
    });
  });

  // Medium-Hard (7)
  const mhPowers: SpecialPower[] = ['DEDUCT_100', 'PASS_QUESTION', 'STEAL_PASS', 'NONE', 'NONE', 'NONE', 'NONE'];
  mhPowers.forEach((p, i) => {
    deck.push({
      id: `MH-${i}`,
      name: i < 3 ? 'كارت مميز' : 'تحدي عبقري',
      difficulty: 'متوسط-صعب',
      special: p,
      points: 200,
      subject: subjects[i % subjects.length]
    });
  });

  // Medium (18)
  for (let i = 0; i < 18; i++) {
    deck.push({
      id: `M-${i}`,
      name: 'سؤال متوسط',
      difficulty: 'متوسط',
      special: 'NONE',
      points: 100,
      subject: subjects[i % subjects.length]
    });
  }

  // Easy (30)
  for (let i = 0; i < 30; i++) {
    deck.push({
      id: `E-${i}`,
      name: 'سؤال سهل',
      difficulty: 'سهل',
      special: 'NONE',
      points: 50,
      subject: subjects[i % subjects.length]
    });
  }

  return deck.sort(() => 0.5 - Math.random());
};

// --- Components ---

interface CardViewProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  isSelected?: boolean;
}

const CardView: React.FC<CardViewProps> = ({ card, onClick, disabled, isSelected }) => {
  const isHard = card.difficulty === 'صعب-جدا';
  
  const getBG = () => {
    if (isHard) return 'bg-[#FFD700] border-[#8B0000] text-[#8B0000]';
    return 'bg-[#f4e4bc] border-[#C8A84B] text-[#0D2B1A]';
  };

  const getIcon = () => {
    const size = 16;
    switch (card.subject) {
      case 'اللغة العربية': return <BookOpen size={size} />;
      case 'الأحياء': return <Dna size={size} />;
      case 'الفيزياء': return <Atom size={size} />;
      case 'الرياضيات': return <Calculator size={size} />;
      case 'الكيمياء': return <Brain size={size} />;
    }
  };

  return (
    <motion.div
      whileHover={!disabled ? { scale: 1.05, y: -20 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={!disabled ? onClick : undefined}
      className={`relative w-28 h-40 rounded-xl shadow-xl cursor-pointer flex flex-col p-3 text-right transition-all border-2 select-none ${getBG()} ${disabled ? 'opacity-50 grayscale' : ''} ${isSelected ? 'ring-4 ring-white -translate-y-6 z-50' : ''}`}
    >
      <div className={`text-[10px] font-black uppercase border-b pb-1 mb-2 ${isHard ? 'border-[#8B0000]/20' : 'border-[#0D2B1A]/10'}`}>
        {card.difficulty}
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
         {getIcon()}
         <span className="text-sm font-black leading-tight">{card.name}</span>
      </div>

      <div className="w-full flex justify-between items-center mt-auto pt-1 font-black">
        <span className="text-lg">{card.points}</span>
        {card.isArmed && (
          <div className="absolute -top-2 -right-2 bg-[#8B0000] text-white w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
             <Sword size={12} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<'intro' | 'setup' | 'playing' | 'result'>('intro');
  const [track, setTrack] = useState<'science' | 'math'>('science');
  const [players, setPlayers] = useState<Player[]>([
    { id: 0, name: 'لاعب ١', team: 'A', score: 0, isTeammateOf: 2 },
    { id: 1, name: 'لاعب ٢', team: 'B', score: 0, isTeammateOf: 3 },
    { id: 2, name: 'لاعب ٣', team: 'A', score: 0, isTeammateOf: 0 },
    { id: 3, name: 'لاعب ٤', team: 'B', score: 0, isTeammateOf: 1 },
  ]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [deck, setDeck] = useState<Card[]>([]);
  const [hands, setHands] = useState<Record<number, Card[]>>({});
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timer, setTimer] = useState(60);
  const [isAnswering, setIsAnswering] = useState(false);
  const [effects, setEffects] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [passedToTeammate, setPassedToTeammate] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('متوسط');
  const [showExplanation, setShowExplanation] = useState(false);
  const [lastAnswerInfo, setLastAnswerInfo] = useState<{ isCorrect: boolean, selectedIndex: number } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // --- Start Game ---
  const startGame = (chosenTrack: 'science' | 'math') => {
    const fullDeck = createDeck(chosenTrack);
    const newHands: Record<number, Card[]> = {};
    for (let i = 0; i < 4; i++) {
      newHands[i] = fullDeck.splice(0, 5); // Start with 5 cards each
    }
    
    // Setup AI Players
    const newPlayers: Player[] = [
      { id: 0, name: 'أنت', team: 'A', score: 0, isTeammateOf: 2, isAI: false },
      { id: 1, name: 'الخصم ١', team: 'B', score: 0, isTeammateOf: 3, isAI: true },
      { id: 2, name: 'الزميل (AI)', team: 'A', score: 0, isTeammateOf: 0, isAI: true },
      { id: 3, name: 'الخصم ٢', team: 'B', score: 0, isTeammateOf: 1, isAI: true },
    ];

    setPlayers(newPlayers);
    setDeck(fullDeck);
    setHands(newHands);
    setTrack(chosenTrack);
    setGameState('playing');
    setCurrentPlayerIndex(0); // Human starts
    setSelectedCard(null);
    setCurrentQuestion(null);
    setIsAnswering(false);
    setShowExplanation(false);
    setLastAnswerInfo(null);
  };

  // --- Turn Logic ---
  const nextTurn = useCallback(() => {
    const nextIdx = (currentPlayerIndex + 1) % 4;
    
    // Resets
    setSelectedCard(null);
    setCurrentQuestion(null);
    setIsAnswering(false);
    setShowExplanation(false);
    setLastAnswerInfo(null);
    setTimer(60);
    setPassedToTeammate(false);
    setIsAiThinking(false);

    // Check for skip/freeze
    if (players[nextIdx].nextTurnEffect === 'FREEZE') {
      const updatedPlayers = [...players];
      updatedPlayers[nextIdx].nextTurnEffect = undefined;
      setPlayers(updatedPlayers);
      setEffects(prev => [...prev, `تم تجميد دور ${players[nextIdx].name}!`]);
      
      // Move even further
      setTimeout(() => {
        setCurrentPlayerIndex((nextIdx + 1) % 4);
      }, 1000);
      return;
    }

    setCurrentPlayerIndex(nextIdx);
  }, [currentPlayerIndex, players]);

  // --- Card Selection ---
  const handlePlayCard = (card: Card) => {
    if (showExplanation || isAnswering) return;
    setSelectedCard(card);
    const q = getRandomQuestions(card.subject, 1)[0] || QUESTIONS_BANK[0];
    setCurrentQuestion(q);
    setIsAnswering(true);
    setTimer(60);
    setShowExplanation(false);
    setLastAnswerInfo(null);
  };

  // --- Answer Choice ---
  const handleAnswer = (index: number) => {
    if (!currentQuestion || !selectedCard || showExplanation) return;
    
    const isCorrect = index === currentQuestion.correctIndex;
    const actorIdx = passedToTeammate ? players[currentPlayerIndex].isTeammateOf : currentPlayerIndex;
    const actor = players[actorIdx];

    const updatedPlayers = [...players];
    let pointsGained = 0;

    if (isCorrect) {
      pointsGained = selectedCard.points;
      
      if (actor.nextTurnEffect === 'TRIPLE') {
        pointsGained *= 3;
        updatedPlayers[actorIdx].nextTurnEffect = undefined;
      }

      // Special Powers
      if (selectedCard.special === 'REVENGE') {
        const prevIdx = (currentPlayerIndex + 3) % 4;
        const stolen = updatedPlayers[prevIdx].score;
        updatedPlayers[prevIdx].score = 0;
        pointsGained += 300 + stolen;
      }
      if (selectedCard.special === 'TRIPLE') {
        updatedPlayers[actor.isTeammateOf].nextTurnEffect = 'TRIPLE';
      }
      if (selectedCard.special === 'STEAL_ALL') {
        const targetIdx = (currentPlayerIndex + 1) % 4;
        const stolen = updatedPlayers[targetIdx].score;
        updatedPlayers[targetIdx].score = 0;
        pointsGained += stolen;
      }
      if (selectedCard.special === 'DOUBLE_STRIKE') {
        const targetIdx = (currentPlayerIndex + 1) % 4;
        updatedPlayers[targetIdx].score = Math.max(0, updatedPlayers[targetIdx].score - 100);
        pointsGained += 200;
        if (selectedCard.isArmed) updatedPlayers[targetIdx].nextTurnEffect = 'FREEZE';
      }
      if (selectedCard.special === 'NUKE') {
        pointsGained = 500;
        if (selectedCard.isArmed) updatedPlayers[actor.isTeammateOf].score += 150;
      }
      if (selectedCard.special === 'DEDUCT_100') {
        const targetIdx = (currentPlayerIndex + 1) % 4;
        updatedPlayers[targetIdx].score = Math.max(0, updatedPlayers[targetIdx].score - 100);
      }

      updatedPlayers[actorIdx].score += pointsGained;
    } else {
      if (selectedCard.special === 'NUKE') {
        updatedPlayers[actorIdx].score = Math.max(0, updatedPlayers[actorIdx].score - 200);
      }
    }

    setHistory(prev => [...prev, { p: actor.name, q: currentQuestion.text, correct: isCorrect, pts: isCorrect ? pointsGained : 0 }]);
    
    // Show Explanation
    setLastAnswerInfo({ isCorrect, selectedIndex: index });
    setShowExplanation(true);
    setPlayers(updatedPlayers);

    // Card usage
    const newHands = { ...hands };
    newHands[currentPlayerIndex] = newHands[currentPlayerIndex].filter(c => c.id !== selectedCard.id);
    if (deck.length > 0) {
      newHands[currentPlayerIndex].push(deck[0]);
      setDeck(prev => prev.slice(1));
    }
    setHands(newHands);
  };

  const handleCloseQuestion = () => {
    if (Object.values(hands).every((h: any) => h.length === 0) && deck.length === 0) {
      setGameState('result');
    } else {
      nextTurn();
    }
  };

  // --- Side Effects ---
  useEffect(() => {
    let interval: any;
    if (isAnswering && timer > 0 && !showExplanation) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    } else if (timer === 0 && isAnswering && !showExplanation) {
      handleAnswer(-1); // Timeout as wrong answer
    }
    return () => clearInterval(interval);
  }, [isAnswering, timer, handleAnswer, showExplanation]);

  // --- AI Logic ---
  useEffect(() => {
    if (gameState !== 'playing' || !players[currentPlayerIndex]?.isAI || isAnswering || isAiThinking) return;

    // AI Thinking & Play Card
    setIsAiThinking(true);
    const thinkTime = 2000 + Math.random() * 2000;
    
    const timeout = setTimeout(() => {
      const hand = hands[currentPlayerIndex] || [];
      if (hand.length > 0) {
        const randomCard = hand[Math.floor(Math.random() * hand.length)];
        handlePlayCard(randomCard);
      }
    }, thinkTime);

    return () => clearTimeout(timeout);
  }, [currentPlayerIndex, players, gameState, isAnswering, isAiThinking, hands]);

  useEffect(() => {
    if (isAnswering && players[currentPlayerIndex]?.isAI && !showExplanation) {
      // AI Answering Delay: 17 seconds as requested
      const answerDelay = 17000;
      const timeout = setTimeout(() => {
        let prob = 0.5;
        if (aiDifficulty === 'سهل') prob = 0.3;
        if (aiDifficulty === 'متوسط') prob = 0.65;
        if (aiDifficulty === 'صعب') prob = 0.9;

        const isCorrect = Math.random() < prob;
        const answerToken = isCorrect ? currentQuestion?.correctIndex : (currentQuestion?.correctIndex === 0 ? 1 : 0);
        handleAnswer(answerToken ?? -1);
      }, answerDelay);

      return () => clearTimeout(timeout);
    }
  }, [isAnswering, currentPlayerIndex, players, showExplanation, aiDifficulty, currentQuestion]);

  // Auto-close AI explanation
  useEffect(() => {
    if (showExplanation && players[currentPlayerIndex]?.isAI) {
      const closeTimeout = setTimeout(() => {
        handleCloseQuestion();
      }, 5000);
      return () => clearTimeout(closeTimeout);
    }
  }, [showExplanation, currentPlayerIndex, players]);

  // --- UI Sections ---

  if (gameState === 'intro') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-8 bg-dark-green relative overflow-hidden" dir="rtl">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-10 left-10"><Dna size={120} className="text-gold" /></div>
          <div className="absolute bottom-10 right-10"><Atom size={120} className="text-gold" /></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"><Brain size={300} className="text-gold" /></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10"
        >
          <div className="inline-block p-1 rounded-2xl bg-gradient-to-b from-gold to-transparent mb-4">
             <div className="bg-dark-green rounded-xl px-12 py-8 border border-gold/30">
                <h1 className="text-7xl md:text-9xl font-black text-gold drop-shadow-[0_0_15px_rgba(200,168,75,0.4)]">
                  ثانوية بطولة
                </h1>
                <p className="text-xl md:text-2xl text-gold/80 font-bold mt-4 tracking-widest">مواجهة العباقرة ٢٠٢٦</p>
             </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl z-10">
          <button 
            onClick={() => setGameState('setup')}
            className="group relative flex items-center justify-center p-8 bg-gold rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:scale-105 transition-all text-dark-green font-black text-3xl overflow-hidden border-4 border-white/20"
          >
            <Users className="ml-3" /> ابدأ المواجهة
          </button>
          <div className="p-8 bg-white/5 backdrop-blur-md border-2 border-gold/20 rounded-[32px] flex items-center justify-center text-gold font-black text-xl hover:bg-gold/10 transition-colors cursor-pointer">
            <Shield className="ml-3" /> المناهج المعتمدة
          </div>
        </div>

        <div className="text-gold/40 text-sm font-black tracking-widest uppercase">
           نظام المحاكاة المتطور للمرحلة الثانوية
        </div>
      </div>
    );
  }

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-dark-green">
        <motion.div 
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="w-full max-w-lg bg-white/5 backdrop-blur-xl p-10 rounded-[40px] border-2 border-gold/20 shadow-2xl space-y-10"
        >
          <div className="text-center">
             <h2 className="text-5xl font-black text-gold mb-2">اختر مسارك</h2>
             <div className="h-1 w-20 bg-gold mx-auto rounded-full mb-6" />
             
             <div className="flex justify-center gap-3 mb-8">
                {(['سهل', 'متوسط', 'صعب'] as AIDifficulty[]).map((level) => (
                   <button
                     key={level}
                     onClick={() => setAiDifficulty(level)}
                     className={`px-4 py-2 rounded-xl font-black text-sm transition-all border-2 ${aiDifficulty === level ? 'bg-gold text-dark-green border-gold' : 'bg-white/5 text-gold border-gold/20'}`}
                   >
                      مستوى الـ AI: {level}
                   </button>
                ))}
             </div>
          </div>
          
          <div className="space-y-6">
            <button 
              onClick={() => startGame('science')}
              className="w-full p-8 bg-white/5 border-2 border-white/10 rounded-3xl flex items-center justify-between hover:border-gold hover:bg-gold/10 transition-all group text-right"
            >
              <div className="flex-1">
                <span className="block text-3xl font-black text-white group-hover:text-gold transition-colors">شعبة علمي علوم</span>
                <span className="text-sm opacity-60 font-bold">أحياء • فيزياء • كيمياء • لغة عربية</span>
              </div>
              <Dna size={48} className="text-gold opacity-40 group-hover:opacity-100 transition-all group-hover:rotate-12" />
            </button>
            <button 
              onClick={() => startGame('math')}
              className="w-full p-8 bg-white/5 border-2 border-white/10 rounded-3xl flex items-center justify-between hover:border-gold hover:bg-gold/10 transition-all group text-right"
            >
              <div className="flex-1">
                <span className="block text-3xl font-black text-white group-hover:text-gold transition-colors">شعبة علمي رياضة</span>
                <span className="text-sm opacity-60 font-bold">رياضيات • فيزياء • كيمياء • لغة عربية</span>
              </div>
              <Calculator size={48} className="text-gold opacity-40 group-hover:opacity-100 transition-all group-hover:rotate-12" />
            </button>
          </div>
          <p className="text-center text-xs text-gold/40 font-bold leading-relaxed">
             * بطولة تعاونية: ٤ لاعبين في نظام (٢ ضد ٢) <br/>
             الإجابة الصحيحة تمنح فريقك التقدم نحو النصر
          </p>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'playing') {
    const currentPlayer = players[currentPlayerIndex];

    return (
      <div className="h-screen flex flex-col overflow-hidden select-none bg-dark-green text-[#E0E0E0] relative" dir="rtl">
        {/* Background Patterns */}
        <div className="absolute inset-0 opacity-5 pointer-events-none z-0">
          <div className="absolute top-1/4 left-1/4 rotate-12"><Atom size={200} className="text-gold" /></div>
          <div className="absolute bottom-1/4 right-1/4 -rotate-12"><Dna size={200} className="text-gold" /></div>
        </div>

        {/* Top: Header/Scores */}
        <div className="h-[70px] bg-black/40 border-b-2 border-gold flex items-center justify-between px-8 z-30 shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-4">
             <div className="text-2xl font-black text-gold tracking-tighter flex items-center gap-4 drop-shadow-lg">
                <Shield size={24} className="text-gold" />
                بطولة العباقرة الثانوية ٢٠٢٦
             </div>
          </div>
          
          <div className="flex items-center gap-8">
             <div className="flex items-center gap-6 border-l border-white/10 pl-6 h-10">
                <div className="flex flex-col items-end">
                  <div className="text-[10px] font-black text-gold opacity-60">فريق العلوم (أ)</div>
                  <div className="text-xl font-black text-white leading-none">{players[0].score + players[2].score}</div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-[10px] font-black text-red-400 opacity-60">فريق الرياضة (ب)</div>
                  <div className="text-xl font-black text-white leading-none">{players[1].score + players[3].score}</div>
                </div>
             </div>

             <div className="flex items-center gap-3">
                <div className="text-left leading-none">
                   <div className="text-[10px] opacity-60 uppercase font-black text-gold">اللاعب الحالي</div>
                   <div className="text-lg font-black text-white">{players[currentPlayerIndex].name}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-dark-green font-black shadow-[0_0_15px_rgba(200,168,75,0.4)]">
                   {currentPlayerIndex + 1}
                </div>
             </div>
          </div>
        </div>

        {/* Main Viewport */}
        <div className="flex-1 flex p-4 gap-4 relative overflow-hidden">
           
           {/* Sidebar: Activity Log */}
           <div className="w-72 flex flex-col gap-4 z-10">
              <div className="bg-black/40 backdrop-blur-md rounded-[32px] border border-white/10 p-5 flex flex-col h-full shadow-2xl">
                 <h4 className="text-sm font-black text-gold mb-4 flex items-center gap-2">
                    <History size={16} /> ساحة المعركة
                 </h4>
                 <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                    {history.length === 0 && (
                      <div className="text-white/20 text-xs italic text-center mt-10">
                        البطولة في بدايتها...
                      </div>
                    )}
                    {history.slice().reverse().map((h, i) => (
                       <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={i} 
                        className="bg-white/5 p-3 rounded-2xl border border-white/5 text-right relative overflow-hidden"
                       >
                          <div className={`absolute top-0 right-0 w-1 h-full ${h.correct ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div className="font-black text-[10px] text-gold/60">{h.p}</div>
                          <div className={`text-sm font-bold ${h.correct ? 'text-green-400' : 'text-red-400'}`}>
                             {h.correct ? `أصاب! ${h.pts}+` : 'أخطأ الهدف'}
                          </div>
                       </motion.div>
                    ))}
                 </div>
              </div>
           </div>

           {/* Table & Game Action Area */}
           <div className="flex-1 relative flex flex-col items-center justify-center">
              {/* Question Overlay */}
              <AnimatePresence>
                {isAnswering && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-dark-green/30 backdrop-blur-md"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="bg-[#0a1a12]/95 w-full max-w-4xl h-full max-h-[720px] rounded-[56px] border-2 border-gold/30 p-12 flex flex-col shadow-2xl relative overflow-hidden overflow-y-auto custom-scrollbar"
                    >
                       <div className="flex justify-between items-start mb-8 w-full z-10 shrink-0">
                         <div className="bg-gold text-dark-green px-8 py-2 rounded-xl font-black text-xl shadow-xl">
                            {selectedCard?.subject}
                         </div>
                         <div className="flex flex-col items-end gap-3 font-black">
                           <div className="bg-deep-red/40 px-6 py-2 rounded-full border-2 border-deep-red text-white flex items-center gap-3">
                                <Timer size={24} /> {timer}
                           </div>
                         </div>
                       </div>
                       
                       <div className="flex-1 flex flex-col justify-center gap-8 z-10">
                          <h2 className="text-4xl md:text-5xl font-black text-right text-white">
                             {currentQuestion?.text}
                          </h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {currentQuestion?.options.map((opt, i) => (
                                <button
                                   key={i}
                                   onClick={() => !showExplanation && handleAnswer(i)}
                                   disabled={showExplanation}
                                   className={`p-6 rounded-[24px] text-right font-black text-xl border-2 transition-all ${showExplanation ? (i === currentQuestion.correctIndex ? 'bg-green-600 border-green-400' : (lastAnswerInfo?.selectedIndex === i ? 'bg-red-600 border-red-400' : 'opacity-20')) : 'bg-white/5 border-white/10 hover:border-gold'}`}
                                >
                                   {opt}
                                </button>
                             ))}
                          </div>
                       </div>

                       {showExplanation && (
                          <div className="mt-8 bg-black/40 border-2 border-gold p-6 rounded-[32px] relative">
                             <button onClick={handleCloseQuestion} className="absolute -top-4 -right-4 w-12 h-12 bg-gold text-dark-green rounded-full flex items-center justify-center font-black text-2xl">X</button>
                             <div className="text-gold font-black mb-2 flex items-center gap-3"><BookOpen size={20}/> التفسير:</div>
                             <p className="text-white text-xl text-right">{currentQuestion?.explanation}</p>
                          </div>
                       )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Table (Tarneeb Style) */}
              <div className="w-full max-w-2xl aspect-square rounded-full border-[15px] border-black/20 flex items-center justify-center relative bg-[#0d2b1a] shadow-inner">
                 <div className="absolute top-0 -translate-y-1/2 flex flex-col items-center gap-1 opacity-60">
                    <div className="w-20 h-20 rounded-2xl bg-black/40 flex items-center justify-center border-2 border-white/10"><Users size={32} /></div>
                    <span className="text-xs font-black">{players[2].name}</span>
                 </div>
                 <div className="absolute bottom-0 translate-y-1/2 flex flex-col items-center gap-1">
                    <div className="w-24 h-24 rounded-2xl bg-gold/20 flex items-center justify-center border-4 border-gold shadow-lg"><Users size={40} className="text-gold" /></div>
                    <span className="text-sm font-black text-gold">{players[0].name} (أنت)</span>
                 </div>
                 <div className="absolute left-0 -translate-x-1/2 flex items-center gap-4 opacity-60">
                    <div className="flex flex-col items-center gap-1">
                       <div className="w-20 h-20 rounded-2xl bg-black/40 flex items-center justify-center border-2 border-white/10"><Brain size={32} /></div>
                       <span className="text-xs font-black">{players[3].name}</span>
                    </div>
                 </div>
                 <div className="absolute right-0 translate-x-1/2 flex items-center gap-4 opacity-60">
                    <div className="flex flex-col items-center gap-1">
                       <div className="w-20 h-20 rounded-2xl bg-black/40 flex items-center justify-center border-2 border-white/10"><Brain size={32} /></div>
                       <span className="text-xs font-black">{players[1].name}</span>
                    </div>
                 </div>

                 {selectedCard && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1.2 }} className="z-30 shadow-2xl">
                       <CardView card={selectedCard} />
                    </motion.div>
                 )}
              </div>
           </div>
        </div>

        {/* Hand Section */}
        <div className="h-[280px] bg-gradient-to-t from-[#050d0a] to-[#0d2b1a] border-t-4 border-gold/20 flex items-end justify-center px-10 pb-16 relative z-40 shrink-0">
           {isAiThinking && players[currentPlayerIndex].isAI && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-8 left-1/2 -translate-x-1/2 bg-gold/10 px-12 py-3 rounded-full border-2 border-gold text-gold font-black text-xl animate-pulse shadow-[0_0_40px_rgba(200,168,75,0.2)] z-50 backdrop-blur-md"
              >
                 {players[currentPlayerIndex].name} يخطط لضربته القادمة...
              </motion.div>
           )}
           
           <div className="flex items-end justify-center w-full max-w-7xl pt-10">
              <div className="flex -space-x-12 md:-space-x-16 lg:-space-x-20 rtl:space-x-reverse justify-center items-end h-full w-full">
                {(hands[0] || []).map((card: Card, idx) => (
                  <motion.div 
                    key={card.id} 
                    whileHover={{ 
                      y: -100, 
                      scale: 1.15, 
                      zIndex: 100,
                      rotate: 0,
                      transition: { duration: 0.2 } 
                    }}
                    className="transition-all duration-300 origin-bottom" 
                    style={{ 
                      zIndex: idx,
                      transform: `rotate(${(idx - (hands[0].length / 2)) * 3}deg)`
                    }}
                  >
                    <CardView 
                      card={card} 
                      onClick={() => handlePlayCard(card)} 
                      disabled={isAnswering || players[currentPlayerIndex].isAI || gameState !== 'playing' || currentPlayerIndex !== 0}
                      isSelected={selectedCard?.id === card.id}
                    />
                  </motion.div>
                ))}
              </div>
           </div>

           <div className="absolute left-12 bottom-12">
              <button 
                onClick={() => setGameState('intro')}
                className="bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/10 px-8 py-3 rounded-2xl font-black text-xs transition-all border border-white/10 hover:border-red-500/50 uppercase tracking-widest backdrop-blur-sm"
              >
                 انسحاب مشرف
              </button>
           </div>
        </div>
      </div>
    );
  }

  if (gameState === 'result') {
    const teamAScore = players[0].score + players[2].score;
    const teamBScore = players[1].score + players[3].score;
    const winner = teamAScore > teamBScore ? 'فريق أ' : 'فريق ب';
    
    return (
      <div className="min-h-screen p-6 bg-dark-green flex flex-col items-center justify-center space-y-12 overflow-y-auto">
        <motion.div 
           initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
           className="text-center"
        >
          <div className="relative inline-block">
             <Trophy size={160} className="mx-auto text-gold mb-6 drop-shadow-[0_0_50px_rgba(200,168,75,0.4)]" />
             <div className="absolute inset-0 animate-ping opacity-20 bg-gold rounded-full scale-150" />
          </div>
          <h2 className="text-7xl font-black text-white">نصر تاريخي لـ {winner}</h2>
          <p className="text-2xl text-gold mt-4 font-bold">المستوى التعليمي: عباقرة الثانوية ٢٠٢٦</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
           <div className={`p-10 rounded-[40px] border-2 flex flex-col items-center shadow-2xl transition-all ${winner === 'فريق أ' ? 'bg-gold/10 border-gold' : 'bg-white/5 border-white/10 opacity-40'}`}>
              <h3 className="text-3xl font-black text-gold mb-4">فريق أ (العلوم)</h3>
              <span className="text-8xl font-black text-white">{teamAScore}</span>
              <div className="mt-6 flex gap-10 text-sm font-black border-t border-gold/20 pt-4">
                 <div className="text-center">
                    <div className="opacity-50 mb-1">{players[0].name}</div>
                    <div className="text-lg text-gold">{players[0].score}</div>
                 </div>
                 <div className="text-center">
                    <div className="opacity-50 mb-1">{players[2].name}</div>
                    <div className="text-lg text-gold">{players[2].score}</div>
                 </div>
              </div>
           </div>
           
           <div className={`p-10 rounded-[40px] border-2 flex flex-col items-center shadow-2xl transition-all ${winner === 'فريق ب' ? 'bg-deep-red/10 border-deep-red' : 'bg-white/5 border-white/10 opacity-40'}`}>
              <h3 className="text-3xl font-black text-deep-red mb-4">فريق ب (الرياضيات)</h3>
              <span className="text-8xl font-black text-white">{teamBScore}</span>
              <div className="mt-6 flex gap-10 text-sm font-black border-t border-deep-red/20 pt-4">
                 <div className="text-center">
                    <div className="opacity-50 mb-1">{players[1].name}</div>
                    <div className="text-lg text-deep-red">{players[1].score}</div>
                 </div>
                 <div className="text-center">
                    <div className="opacity-50 mb-1">{players[3].name}</div>
                    <div className="text-lg text-deep-red">{players[3].score}</div>
                 </div>
              </div>
           </div>
        </div>

        <div className="w-full max-w-3xl bg-black/40 p-8 rounded-[40px] border border-gold/20 backdrop-blur-md">
           <h4 className="text-2xl font-black mb-6 flex items-center gap-3 text-gold">
              <RotateCcw size={24}/> سجل المعركة التعليمية
           </h4>
           <div className="max-h-80 overflow-y-auto space-y-4 px-2 pr-6 custom-scrollbar">
              {history.map((h, i) => (
                <div key={i} className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${h.correct ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                         {h.correct ? '✓' : '✗'}
                      </div>
                      <div className="text-right">
                         <div className="font-black text-white">{h.p}</div>
                         <div className="text-xs opacity-50 truncate max-w-[200px]">{h.q}</div>
                      </div>
                   </div>
                   <div className="text-2xl font-black text-gold">+{h.pts}</div>
                </div>
              ))}
           </div>
        </div>

        <button 
           onClick={() => window.location.reload()}
           className="px-16 py-6 bg-gold text-dark-green font-black text-2xl rounded-[32px] shadow-2xl hover:scale-110 transition-all border-4 border-white/20 active:scale-95"
        >
           تحدّي جديد
        </button>
      </div>
    );
  }

  return null;
}
