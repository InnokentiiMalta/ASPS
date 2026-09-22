import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'react-qr-code';
import { regularQuestions, calculationQuestions, interactiveQuestions, Question, shuffleArray } from './data/questions';

type Screen = 'home' | 'quiz' | 'result' | 'review';

const QUESTION_TIME_LIMIT = 120; // 2 минуты
const TOTAL_QUESTIONS = 25;
const CALC_QUESTIONS_COUNT = 5; // Каждый 5-й — вычислительный
const INTERACTIVE_QUESTIONS_COUNT = 2; // 2 интерактивные задачи
const REGULAR_QUESTIONS_COUNT = TOTAL_QUESTIONS - CALC_QUESTIONS_COUNT - INTERACTIVE_QUESTIONS_COUNT; // 18

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [score, setScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [userName, setUserName] = useState('');
  const [nameEntered, setNameEntered] = useState(false);
  const [animateIn, setAnimateIn] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [timerActive, setTimerActive] = useState(false);
  const [selectedZones, setSelectedZones] = useState<Record<number, string[]>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentUrl = window.location.origin + window.location.pathname;
  const question = testQuestions[currentQuestion];

  // Таймер
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimerActive(false);
            setTimeout(() => {
              handleNext();
            }, 500);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, currentQuestion]);

  useEffect(() => {
    setAnimateIn(true);
  }, [screen, currentQuestion]);

  const handleAnswer = (answer: string | string[]) => {
    setAnswers(prev => ({ ...prev, [question.id]: answer }));
  };

  const isCorrect = useCallback((q: Question): boolean => {
    // Для интерактивных вопросов
    if (q.type === 'interactive' && q.correctZones) {
      const userZones = selectedZones[q.id] || [];
      if (userZones.length === 0) return false;
      return q.correctZones.length === userZones.length && 
        q.correctZones.every(z => userZones.includes(z));
    }

    const userAnswer = answers[q.id];
    if (!userAnswer) return false;

    if (q.type === 'single' || q.type === 'fill' || q.type === 'exclude') {
      const correct = q.correctAnswer as string;
      return typeof userAnswer === 'string' && 
        userAnswer.trim().toLowerCase() === correct.trim().toLowerCase();
    }
    
    if (q.type === 'multiple') {
      const correct = q.correctAnswer as string[];
      const user = userAnswer as string[];
      if (!Array.isArray(user)) return false;
      return correct.length === user.length && 
        correct.every(c => user.includes(c));
    }
    
    return false;
  }, [answers, selectedZones]);

  const calculateScore = () => {
    let total = 0;
    testQuestions.forEach((q) => {
      if (isCorrect(q)) {
        total += q.points;
      }
    });
    return total;
  };

  const handleNext = () => {
    setShowExplanation(false);
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setAnimateIn(false);
    setTimeout(() => {
      if (currentQuestion < testQuestions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setTimeLeft(QUESTION_TIME_LIMIT);
        setTimerActive(true);
      } else {
        setScore(calculateScore());
        setScreen('result');
      }
      setAnimateIn(true);
    }, 150);
  };

  const handleCheckAnswer = () => {
    setShowExplanation(true);
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleToggleMultiple = (option: string) => {
    const current = (answers[question.id] as string[]) || [];
    if (current.includes(option)) {
      handleAnswer(current.filter(o => o !== option));
    } else {
      handleAnswer([...current, option]);
    }
  };

  const handleZoneClick = (zoneId: string) => {
    const current = selectedZones[question.id] || [];
    if (current.includes(zoneId)) {
      setSelectedZones(prev => ({ ...prev, [question.id]: current.filter(z => z !== zoneId) }));
    } else {
      setSelectedZones(prev => ({ ...prev, [question.id]: [...current, zoneId] }));
    }
  };

  const hasInteractiveAnswer = (): boolean => {
    if (question.type !== 'interactive') return false;
    const zones = selectedZones[question.id] || [];
    return zones.length > 0;
  };

  const startQuiz = () => {
    // Выбираем случайные вопросы из каждой категории
    const shuffledRegular = shuffleArray(regularQuestions).slice(0, REGULAR_QUESTIONS_COUNT);
    const shuffledCalc = shuffleArray(calculationQuestions).slice(0, CALC_QUESTIONS_COUNT);
    const shuffledInteractive = shuffleArray(interactiveQuestions).slice(0, INTERACTIVE_QUESTIONS_COUNT);
    
    // Формируем итоговый массив
    const finalQuestions: Question[] = [];
    let calcIndex = 0;
    let regularIndex = 0;
    let interactiveIndex = 0;
    
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      // Каждый 5-й вопрос — вычислительный (позиции 5, 10, 15, 20, 25)
      if ((i + 1) % 5 === 0 && calcIndex < shuffledCalc.length) {
        finalQuestions.push(shuffledCalc[calcIndex]);
        calcIndex++;
      } 
      // Вопросы 8 и 18 — интерактивные
      else if ((i + 1) === 8 || (i + 1) === 18) {
        if (interactiveIndex < shuffledInteractive.length) {
          finalQuestions.push(shuffledInteractive[interactiveIndex]);
          interactiveIndex++;
        } else {
          finalQuestions.push(shuffledRegular[regularIndex]);
          regularIndex++;
        }
      }
      else {
        finalQuestions.push(shuffledRegular[regularIndex]);
        regularIndex++;
      }
    }
    
    setTestQuestions(finalQuestions);
    setCurrentQuestion(0);
    setAnswers({});
    setSelectedZones({});
    setScore(0);
    setShowExplanation(false);
    setTimeLeft(QUESTION_TIME_LIMIT);
    setTimerActive(true);
    setScreen('quiz');
  };

  const restartQuiz = () => {
    setScreen('home');
    setCurrentQuestion(0);
    setAnswers({});
    setSelectedZones({});
    setScore(0);
    setShowExplanation(false);
    setUserName('');
    setNameEntered(false);
    setShowExportMenu(false);
    setTimerActive(false);
    setTimeLeft(QUESTION_TIME_LIMIT);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const getGrade = () => {
    const maxScore = testQuestions.reduce((sum, q) => sum + q.points, 0);
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return { grade: 'Отлично', color: 'text-green-600', bg: 'bg-green-50', emoji: '🏆', desc: 'Превосходное знание материала!' };
    if (percentage >= 75) return { grade: 'Хорошо', color: 'text-blue-600', bg: 'bg-blue-50', emoji: '⭐', desc: 'Хороший уровень подготовки.' };
    if (percentage >= 60) return { grade: 'Удовлетворительно', color: 'text-yellow-600', bg: 'bg-yellow-50', emoji: '👍', desc: 'Базовые знания есть, но есть пробелы.' };
    return { grade: 'Неудовлетворительно', color: 'text-red-600', bg: 'bg-red-50', emoji: '📚', desc: 'Рекомендуется повторить материал.' };
  };

  const getCorrectCount = () => {
    return testQuestions.filter(q => isCorrect(q)).length;
  };

  const getMaxScore = () => {
    return testQuestions.reduce((sum, q) => sum + q.points, 0);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (): string => {
    if (timeLeft > 60) return 'text-green-600';
    if (timeLeft > 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTimerBgColor = (): string => {
    if (timeLeft > 60) return 'from-green-500 to-green-400';
    if (timeLeft > 30) return 'from-yellow-500 to-yellow-400';
    return 'from-red-500 to-red-400';
  };

  const generateTxtReport = (): string => {
    const grade = getGrade();
    const maxScore = getMaxScore();
    const percentage = Math.round((score / maxScore) * 100);
    const date = new Date().toLocaleString('ru-RU');
    
    let report = `═══════════════════════════════════════════
  РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ
  Автоматизированные системы противопожарной
  сигнализации (АСПС)
═══════════════════════════════════════════

Дата: ${date}
Тестируемый: ${userName}

───────────────────────────────────────────
  ИТОГОВЫЙ РЕЗУЛЬТАТ
───────────────────────────────────────────
  Оценка: ${grade.grade}
  Баллы: ${score} / ${maxScore}
  Процент: ${percentage}%
  Правильных ответов: ${getCorrectCount()} из ${testQuestions.length}
───────────────────────────────────────────

ДЕТАЛИЗАЦИЯ ОТВЕТОВ:

`;

    testQuestions.forEach((q, idx) => {
      const correct = isCorrect(q);
      const userAnswer = answers[q.id];
      const isCalc = calculationQuestions.some(cq => cq.id === q.id);
      const isInteractive = q.type === 'interactive';
      
      report += `${idx + 1}. [${correct ? '✓' : '✗'}] ${isCalc ? '[ВЫЧИСЛЕНИЕ] ' : ''}${isInteractive ? '[ГРАФИЧЕСКАЯ] ' : ''}${q.text}\n`;
      
      if (isInteractive && q.correctZones) {
        const userZones = selectedZones[q.id] || [];
        report += `   Выбрано зон: ${userZones.length > 0 ? userZones.join(', ') : '—'}\n`;
        report += `   Правильные зоны: ${q.correctZones.join(', ')}\n`;
      } else if (q.type === 'multiple') {
        const userArr = Array.isArray(userAnswer) ? userAnswer : [];
        report += `   Ваш ответ: ${userArr.length > 0 ? userArr.join('; ') : '—'}\n`;
        report += `   Правильный: ${(q.correctAnswer as string[]).join('; ')}\n`;
      } else {
        report += `   Ваш ответ: ${userAnswer || '—'}\n`;
        if (!correct) {
          report += `   Правильный: ${q.correctAnswer as string}\n`;
        }
      }
      
      report += `   Пояснение: ${q.explanation}\n`;
      if (q.reference) {
        report += `   Источник: ${q.reference}\n`;
      }
      report += '\n';
    });

    report += `═══════════════════════════════════════════
  Конец отчёта
═══════════════════════════════════════════`;

    return report;
  };

  const handleExportTxt = async () => {
    const report = generateTxtReport();
    const fileName = `АСПС_тест_${userName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;

    if (navigator.share && navigator.canShare) {
      const file = new File([report], fileName, { type: 'text/plain;charset=utf-8' });
      const shareData = {
        files: [file],
        title: 'Результаты теста АСПС',
        text: `Результаты тестирования по АСПС: ${userName} — ${score}/${getMaxScore()} баллов`
      };
      
      try {
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setShowExportMenu(false);
          return;
        }
      } catch (err) {
        // fall through to download
      }
    }

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleCopyToClipboard = async () => {
    const report = generateTxtReport();
    try {
      await navigator.clipboard.writeText(report);
      alert('Результаты скопированы в буфер обмена!');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Результаты скопированы в буфер обмена!');
    }
    setShowExportMenu(false);
  };

  const renderHome = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-orange-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl p-6 md:p-8 text-center animate-fade-in">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <span className="text-4xl">🔥</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Тест по АСПС
          </h1>
          <p className="text-sm md:text-base text-gray-500 mb-4">
            Автоматизированные системы противопожарной сигнализации
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="bg-red-50 text-red-700 px-3 py-1.5 rounded-full text-xs font-medium">
              📝 {TOTAL_QUESTIONS} вопросов
            </span>
            <span className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-xs font-medium">
              🧮 {CALC_QUESTIONS_COUNT} вычислений
            </span>
            <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-medium">
              🖱️ {INTERACTIVE_QUESTIONS_COUNT} графических
            </span>
            <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-medium">
              ⏱ 2 мин/вопрос
            </span>
          </div>
        </div>

        {!nameEntered ? (
          <div className="space-y-4">
            <div className="text-left">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 Введите ваше ФИО:
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && userName.trim()) {
                    setNameEntered(true);
                  }
                }}
                autoFocus
              />
              <button
                onClick={() => userName.trim() && setNameEntered(true)}
                disabled={!userName.trim()}
                className="mt-3 w-full bg-red-600 text-white py-3.5 rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed active:scale-95 transform"
              >
                Продолжить →
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-700 font-medium text-lg">
              Здравствуйте, <span className="text-red-600">{userName}</span>! 👋
            </p>
            
            <div className="bg-gray-50 rounded-xl p-4 text-left text-sm text-gray-600 space-y-2">
              <p className="font-semibold text-gray-700">📋 Правила теста:</p>
              <ul className="space-y-1 text-xs">
                <li>• {TOTAL_QUESTIONS} вопросов из базы {regularQuestions.length + calculationQuestions.length + interactiveQuestions.length} (каждый раз по-новому)</li>
                <li>• На каждый вопрос — 2 минуты</li>
                <li>• Каждый 5-й вопрос — на вычисления</li>
                <li>• {INTERACTIVE_QUESTIONS_COUNT} интерактивные графические задачи</li>
                <li>• Вопросы с одним ответом, множественным выбором, вводом текста и исключением</li>
                <li>• После ответа — объяснение со ссылкой на нормативный документ</li>
                <li>• По завершении можно экспортировать результаты в TXT</li>
              </ul>
            </div>

            <button
              onClick={startQuiz}
              className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg"
            >
              🚀 Начать тест
            </button>
            
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-3">
                📱 Сканируйте QR-код для прохождения с телефона:
              </p>
              <div className="inline-block p-4 bg-white rounded-xl shadow-md border border-gray-100">
                <QRCode
                  value={currentUrl}
                  size={160}
                  level="M"
                />
              </div>
              <div className="mt-3">
                <p className="text-xs text-gray-400 mb-1">Или откройте ссылку на телефоне:</p>
                <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 break-all font-mono select-all cursor-pointer hover:bg-gray-100 transition-colors">
                  {currentUrl}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const getTypeLabel = (q: Question) => {
    const isCalc = calculationQuestions.some(cq => cq.id === q.id);
    if (isCalc) return { label: '🧮 Вычисление', className: 'bg-amber-50 text-amber-700' };
    if (q.type === 'interactive') return { label: '🖱️ Графическая задача', className: 'bg-indigo-50 text-indigo-700' };
    switch (q.type) {
      case 'single': return { label: '🔘 Один ответ', className: 'bg-blue-50 text-blue-700' };
      case 'multiple': return { label: '☑️ Несколько ответов', className: 'bg-purple-50 text-purple-700' };
      case 'fill': return { label: '✏️ Введите ответ', className: 'bg-green-50 text-green-700' };
      case 'exclude': return { label: '🚫 Исключите неправильный', className: 'bg-rose-50 text-rose-700' };
      default: return { label: '', className: '' };
    }
  };

  const renderQuestion = () => {
    if (!question) return null;
    
    const progress = ((currentQuestion + 1) / testQuestions.length) * 100;
    const typeInfo = getTypeLabel(question);
    const timerProgress = (timeLeft / QUESTION_TIME_LIMIT) * 100;
    const isCalc = calculationQuestions.some(cq => cq.id === question.id);
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-500">
                Вопрос {currentQuestion + 1}/{testQuestions.length}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium">
                  {question.points} {question.points === 1 ? 'балл' : question.points < 5 ? 'балла' : 'баллов'}
                </span>
              </div>
            </div>
            
            {/* Timer */}
            {!showExplanation && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">⏱ Осталось времени</span>
                  <span className={`text-sm font-bold ${getTimerColor()} ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-2 rounded-full bg-gradient-to-r ${getTimerBgColor()} transition-all duration-1000 ease-linear`}
                    style={{ width: `${timerProgress}%` }}
                  />
                </div>
              </div>
            )}
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-red-500 to-orange-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className={`flex-1 max-w-2xl mx-auto w-full px-4 py-5 transition-opacity duration-150 ${animateIn ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`bg-white rounded-2xl shadow-lg p-5 md:p-6 mb-4 ${isCalc ? 'ring-2 ring-amber-200' : ''}`}>
            <div className="flex items-start gap-3 mb-5">
              <span className={`flex-shrink-0 w-9 h-9 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-sm ${
                isCalc ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-red-500 to-orange-500'
              }`}>
                {currentQuestion + 1}
              </span>
              <div className="flex-1">
                <span className={`inline-block text-xs px-2.5 py-1 rounded-full mb-2 font-medium ${typeInfo.className}`}>
                  {typeInfo.label}
                </span>
                <h2 className="text-base md:text-lg font-semibold text-gray-800 leading-relaxed">
                  {question.text}
                </h2>
                {question.hint && (
                  <p className="text-sm text-gray-500 mt-2 italic bg-yellow-50 px-3 py-2 rounded-lg">
                    💡 Подсказка: {question.hint}
                  </p>
                )}
              </div>
            </div>

            {/* Interactive Graphics */}
            {question.type === 'interactive' && question.zones && (
              <div className="mt-4">
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-indigo-200">
                  <svg viewBox="0 0 320 280" className="w-full h-auto" style={{ maxHeight: '300px' }}>
                    {/* Фон */}
                    <rect x="0" y="0" width="320" height="280" fill="#f9fafb" stroke="#d1d5db" strokeWidth="2" />
                    
                    {/* Зоны для клика */}
                    {question.zones.map((zone) => {
                      const isSelected = (selectedZones[question.id] || []).includes(zone.id);
                      const isCorrectZone = zone.correct;
                      
                      let fillColor = '#e5e7eb';
                      let strokeColor = '#9ca3af';
                      
                      if (showExplanation) {
                        if (isSelected && isCorrectZone) {
                          fillColor = '#86efac'; // зелёный
                          strokeColor = '#16a34a';
                        } else if (isSelected && !isCorrectZone) {
                          fillColor = '#fca5a5'; // красный
                          strokeColor = '#dc2626';
                        } else if (!isSelected && isCorrectZone) {
                          fillColor = '#bbf7d0'; // светло-зелёный
                          strokeColor = '#22c55e';
                        }
                      } else if (isSelected) {
                        fillColor = '#c7d2fe'; // индиго
                        strokeColor = '#6366f1';
                      }
                      
                      return (
                        <g key={zone.id}>
                          <rect
                            x={zone.x}
                            y={zone.y}
                            width={zone.width}
                            height={zone.height}
                            fill={fillColor}
                            stroke={strokeColor}
                            strokeWidth="2"
                            rx="4"
                            className={!showExplanation ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
                            onClick={() => !showExplanation && handleZoneClick(zone.id)}
                          />
                          {zone.label && (
                            <text
                              x={zone.x + zone.width / 2}
                              y={zone.y + zone.height / 2}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize="10"
                              fill="#374151"
                              className="pointer-events-none"
                            >
                              {zone.label}
                            </text>
                          )}
                          {isSelected && (
                            <text
                              x={zone.x + zone.width / 2}
                              y={zone.y + zone.height / 2 + (zone.label ? 12 : 0)}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize="16"
                              className="pointer-events-none"
                            >
                              {showExplanation ? (isCorrectZone ? '✓' : '✗') : '✓'}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    
                    {/* Специфичные элементы для разных типов задач */}
                    {question.interactiveType === 'place-detectors' && (
                      <>
                        {/* План помещения */}
                        <text x="160" y="15" textAnchor="middle" fontSize="11" fill="#6b7280">План помещения 12×8 м</text>
                        <line x1="10" y1="25" x2="310" y2="25" stroke="#9ca3af" strokeWidth="1" strokeDasharray="4" />
                        <line x1="10" y1="255" x2="310" y2="255" stroke="#9ca3af" strokeWidth="1" strokeDasharray="4" />
                        <line x1="10" y1="25" x2="10" y2="255" stroke="#9ca3af" strokeWidth="1" strokeDasharray="4" />
                        <line x1="310" y1="25" x2="310" y2="255" stroke="#9ca3af" strokeWidth="1" strokeDasharray="4" />
                      </>
                    )}
                    
                    {question.interactiveType === 'identify-elements' && (
                      <>
                        {/* Схема системы */}
                        <text x="160" y="15" textAnchor="middle" fontSize="11" fill="#6b7280">Схема системы пожарной сигнализации</text>
                        {/* Линии подключения */}
                        <line x1="200" y1="90" x2="65" y2="130" stroke="#6366f1" strokeWidth="2" />
                        <line x1="200" y1="90" x2="165" y2="130" stroke="#6366f1" strokeWidth="2" />
                        <line x1="200" y1="90" x2="265" y2="130" stroke="#6366f1" strokeWidth="2" />
                        <line x1="65" y1="180" x2="65" y2="210" stroke="#6366f1" strokeWidth="2" />
                      </>
                    )}
                    
                    {question.interactiveType === 'connect-sheme' && (
                      <>
                        <text x="160" y="15" textAnchor="middle" fontSize="11" fill="#6b7280">Схемы подключения извещателей</text>
                      </>
                    )}
                  </svg>
                  
                  {/* Легенда */}
                  {!showExplanation && (
                    <div className="mt-3 text-xs text-gray-600 text-center">
                      <p>Кликните на зоны для выбора. Выбрано: {(selectedZones[question.id] || []).length}</p>
                    </div>
                  )}
                  
                  {showExplanation && (
                    <div className="mt-3 text-xs text-center space-y-1">
                      <p className="text-green-600">✓ Правильные зоны</p>
                      <p className="text-red-600">✗ Неправильный выбор</p>
                      <p className="text-green-400">○ Пропущенные правильные зоны</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Answer Options */}
            <div className="space-y-2.5 mt-4">
              {(question.type === 'single' || question.type === 'exclude') && question.options?.map((option, idx) => {
                const isSelected = answers[question.id] === option;
                const isCorrectOption = option === question.correctAnswer;
                const isExclude = question.type === 'exclude';
                
                let btnClass = 'border-gray-200 hover:border-red-300 hover:bg-red-50/50';
                if (isSelected && !showExplanation) {
                  btnClass = isExclude ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-200' : 'border-red-500 bg-red-50 ring-2 ring-red-200';
                } else if (showExplanation && isSelected) {
                  btnClass = isCorrectOption ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50';
                } else if (showExplanation && isCorrectOption) {
                  btnClass = 'border-green-500 bg-green-50';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => !showExplanation && handleAnswer(option)}
                    disabled={showExplanation}
                    className={`w-full text-left p-3.5 md:p-4 rounded-xl border-2 transition-all ${btnClass} ${showExplanation ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        isSelected && !showExplanation ? (isExclude ? 'border-rose-500 bg-rose-500 text-white' : 'border-red-500 bg-red-500 text-white') :
                        showExplanation && isSelected && isCorrectOption ? 'border-green-500 bg-green-500 text-white' :
                        showExplanation && isSelected && !isCorrectOption ? 'border-red-500 bg-red-500 text-white' :
                        showExplanation && isCorrectOption ? 'border-green-500 bg-green-100 text-green-700' :
                        'border-gray-300 text-gray-400'
                      }`}>
                        {showExplanation && isCorrectOption ? '✓' : 
                         showExplanation && isSelected && !isCorrectOption ? '✗' :
                         String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-sm md:text-base text-gray-700">{option}</span>
                    </div>
                  </button>
                );
              })}

              {question.type === 'multiple' && question.options?.map((option, idx) => {
                const selected = ((answers[question.id] as string[]) || []).includes(option);
                const isCorrectOpt = (question.correctAnswer as string[]).includes(option);
                
                let btnClass = 'border-gray-200 hover:border-red-300 hover:bg-red-50/50';
                if (selected && !showExplanation) {
                  btnClass = 'border-red-500 bg-red-50 ring-2 ring-red-200';
                } else if (showExplanation && selected) {
                  btnClass = isCorrectOpt ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50';
                } else if (showExplanation && isCorrectOpt) {
                  btnClass = 'border-green-500 bg-green-50';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => !showExplanation && handleToggleMultiple(option)}
                    disabled={showExplanation}
                    className={`w-full text-left p-3.5 md:p-4 rounded-xl border-2 transition-all ${btnClass} ${showExplanation ? 'cursor-default' : 'cursor-pointer active:scale-[0.98]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`flex-shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        selected && !showExplanation ? 'border-red-500 bg-red-500 text-white' :
                        showExplanation && selected && isCorrectOpt ? 'border-green-500 bg-green-500 text-white' :
                        showExplanation && selected && !isCorrectOpt ? 'border-red-500 bg-red-500 text-white' :
                        showExplanation && isCorrectOpt ? 'border-green-500 bg-green-100 text-green-700' :
                        'border-gray-300'
                      }`}>
                        {selected && (showExplanation ? (isCorrectOpt ? '✓' : '✗') : '✓')}
                      </span>
                      <span className="text-sm md:text-base text-gray-700">{option}</span>
                    </div>
                  </button>
                );
              })}

              {question.type === 'fill' && (
                <div>
                  <input
                    type="text"
                    value={(answers[question.id] as string) || ''}
                    onChange={(e) => handleAnswer(e.target.value)}
                    disabled={showExplanation}
                    placeholder="Введите ваш ответ..."
                    className={`w-full px-4 py-3.5 border-2 rounded-xl focus:outline-none transition-colors text-base ${
                      showExplanation
                        ? isCorrect(question)
                          ? 'border-green-500 bg-green-50'
                          : 'border-red-500 bg-red-50'
                        : 'border-gray-200 focus:border-red-500'
                    }`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && answers[question.id] && !showExplanation) {
                        handleCheckAnswer();
                      }
                    }}
                  />
                  {showExplanation && !isCorrect(question) && (
                    <p className="mt-2 text-sm text-green-600 font-medium bg-green-50 px-3 py-2 rounded-lg">
                      ✅ Правильный ответ: <strong>{question.correctAnswer as string}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Explanation */}
            {showExplanation && (
              <div className={`mt-5 p-4 rounded-xl border animate-fade-in ${
                isCorrect(question) ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{isCorrect(question) ? '✅' : '❌'}</span>
                  <p className={`text-sm font-bold ${isCorrect(question) ? 'text-green-700' : 'text-orange-700'}`}>
                    {isCorrect(question) ? 'Правильно! +' + question.points + ' баллов' : 'Неправильно'}
                  </p>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">{question.explanation}</p>
                {question.reference && (
                  <div className="flex items-start gap-2 bg-white/70 rounded-lg p-2.5 border border-gray-200/50">
                    <span className="text-sm">📄</span>
                    <div className="text-xs">
                      <span className="text-gray-500">Источник: </span>
                      {question.referenceUrl ? (
                        <a 
                          href={question.referenceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline font-medium break-all"
                        >
                          {question.reference}
                        </a>
                      ) : (
                        <span className="text-gray-700 font-medium">{question.reference}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {!showExplanation ? (
              <button
                onClick={handleCheckAnswer}
                disabled={
                  question.type === 'interactive' ? !hasInteractiveAnswer() :
                  !answers[question.id] || (
                    question.type === 'fill' ? !(answers[question.id] as string)?.trim() :
                    question.type === 'multiple' ? ((answers[question.id] as string[]) || []).length === 0 :
                    false
                  )
                }
                className="flex-1 bg-red-600 text-white py-4 rounded-xl font-bold text-base hover:bg-red-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg active:scale-95 transform"
              >
                Проверить ответ ✓
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 text-white py-4 rounded-xl font-bold text-base hover:from-red-700 hover:to-orange-700 transition-all shadow-lg active:scale-95 transform"
              >
                {currentQuestion < testQuestions.length - 1 ? 'Далее →' : 'Завершить тест 🏁'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderResult = () => {
    const grade = getGrade();
    const maxScore = getMaxScore();
    const percentage = Math.round((score / maxScore) * 100);
    const correctCount = getCorrectCount();

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-orange-900 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl p-6 md:p-8 text-center animate-fade-in">
          <div className="text-6xl mb-3">{grade.emoji}</div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1">
            Тест завершён!
          </h1>
          <p className="text-gray-500 text-sm mb-4">{userName}</p>
          
          <div className={`${grade.bg} rounded-2xl p-6 mb-5`}>
            <div className={`text-3xl font-bold ${grade.color} mb-1`}>
              {grade.grade}
            </div>
            <p className="text-sm text-gray-600 mb-3">{grade.desc}</p>
            <div className="text-4xl font-bold text-gray-800 mb-1">
              {score}<span className="text-lg text-gray-400">/{maxScore}</span>
            </div>
            <div className="text-gray-500 text-sm">
              {percentage}% правильных ответов
            </div>
            
            <div className="w-full bg-white/50 rounded-full h-3 mt-4 overflow-hidden">
              <div 
                className={`h-3 rounded-full transition-all duration-1000 ease-out ${
                  percentage >= 90 ? 'bg-green-500' :
                  percentage >= 75 ? 'bg-blue-500' :
                  percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-green-50 rounded-xl p-3">
              <div className="text-xl font-bold text-green-600">{correctCount}</div>
              <div className="text-xs text-gray-600 mt-0.5">Верных</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <div className="text-xl font-bold text-red-600">{testQuestions.length - correctCount}</div>
              <div className="text-xs text-gray-600 mt-0.5">Ошибок</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="text-xl font-bold text-blue-600">{percentage}%</div>
              <div className="text-xs text-gray-600 mt-0.5">Точность</div>
            </div>
          </div>

          {/* Export Section */}
          <div className="relative mb-4">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full bg-indigo-50 text-indigo-700 py-3 rounded-xl font-semibold hover:bg-indigo-100 transition-all active:scale-95 transform flex items-center justify-center gap-2"
            >
              <span>📤</span> Экспорт результатов
            </button>
            
            {showExportMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-200 p-3 space-y-2 animate-fade-in z-20">
                <button
                  onClick={handleExportTxt}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <span className="text-xl">📥</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Скачать TXT файл</p>
                    <p className="text-xs text-gray-500">На телефоне — поделиться файлом</p>
                  </div>
                </button>
                <button
                  onClick={handleCopyToClipboard}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <span className="text-xl">📋</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Копировать в буфер</p>
                    <p className="text-xs text-gray-500">Скопировать текст результатов</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setScreen('review')}
              className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-xl font-semibold hover:bg-gray-200 transition-all active:scale-95 transform"
            >
              📋 Просмотреть ответы
            </button>
            <button
              onClick={restartQuiz}
              className="w-full bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 transition-all active:scale-95 transform shadow-lg"
            >
              🔄 Пройти заново
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderReview = () => {
    return (
      <div className="min-h-screen bg-gray-50 pb-8">
        {/* Header */}
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setScreen('result')}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              ← 
            </button>
            <h1 className="text-lg font-bold text-gray-800">Разбор ответов</h1>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
          {testQuestions.map((q, idx) => {
            const correct = isCorrect(q);
            const isCalc = calculationQuestions.some(cq => cq.id === q.id);
            const isInteractive = q.type === 'interactive';
            return (
              <div key={q.id} className={`bg-white rounded-xl shadow-sm border-l-4 p-4 ${
                correct ? 'border-green-500' : 'border-red-500'
              } ${isCalc ? 'ring-1 ring-amber-200' : ''} ${isInteractive ? 'ring-1 ring-indigo-200' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    correct ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    {correct ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-800">
                        {idx + 1}. {q.text}
                      </p>
                      {isCalc && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          🧮 Вычисление
                        </span>
                      )}
                      {isInteractive && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                          🖱️ Графическая
                        </span>
                      )}
                    </div>
                    <div className="text-xs space-y-1">
                      {q.type === 'interactive' && q.correctZones ? (
                        <>
                          <p className="text-gray-500">
                            Выбрано зон: <span className={correct ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {(selectedZones[q.id] || []).length > 0 ? (selectedZones[q.id] || []).join(', ') : '—'}
                            </span>
                          </p>
                          {!correct && (
                            <p className="text-gray-500">
                              Правильные зоны: <span className="text-green-600 font-medium">
                                {q.correctZones.join(', ')}
                              </span>
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-gray-500">
                            Ваш ответ: <span className={correct ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).join(', ') : (answers[q.id] as string) || '—'}
                            </span>
                          </p>
                          {!correct && (
                            <p className="text-gray-500">
                              Правильный ответ: <span className="text-green-600 font-medium">
                                {Array.isArray(q.correctAnswer) ? (q.correctAnswer as string[]).join(', ') : q.correctAnswer as string}
                              </span>
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 italic bg-gray-50 p-2 rounded-lg">
                      {q.explanation}
                    </p>
                    {q.reference && (
                      <div className="mt-2 flex items-start gap-1.5">
                        <span className="text-xs">📄</span>
                        <span className="text-xs text-gray-500">
                          {q.referenceUrl ? (
                            <a href={q.referenceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {q.reference}
                            </a>
                          ) : (
                            q.reference
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Export in review too */}
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <button
              onClick={handleExportTxt}
              className="w-full bg-indigo-50 text-indigo-700 py-3 rounded-xl font-semibold hover:bg-indigo-100 transition-all active:scale-95 transform flex items-center justify-center gap-2"
            >
              <span>📥</span> Скачать результаты в TXT
            </button>
            <button
              onClick={handleCopyToClipboard}
              className="w-full bg-gray-50 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all active:scale-95 transform flex items-center justify-center gap-2"
            >
              <span>📋</span> Копировать в буфер обмена
            </button>
          </div>

          <button
            onClick={restartQuiz}
            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-all active:scale-95 transform shadow-lg"
          >
            🔄 Пройти тест заново
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="font-sans antialiased">
      {screen === 'home' && renderHome()}
      {screen === 'quiz' && renderQuestion()}
      {screen === 'result' && renderResult()}
      {screen === 'review' && renderReview()}
    </div>
  );
}

export default App;
