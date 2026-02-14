import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, Megaphone, BarChart3, Globe2, Zap, Shield, Clock,
  Users, TrendingUp, CheckCircle, ChevronDown, ChevronUp,
  Play, ArrowRight, Star, MessageSquare, Headphones, Bot,
  IndianRupee, PhoneCall, FileText, Mic
} from 'lucide-react';

// ─── Animated Counter ───
const AnimatedCounter = ({ end, suffix = '', prefix = '', duration = 2000 }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const counted = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const start = 0;
          const startTime = performance.now();
          const animate = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * (end - start) + start));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{prefix}{count.toLocaleString('en-IN')}{suffix}</span>;
};

// ─── Typewriter for Hero ───
const TypewriterText = ({ texts, speed = 80, pause = 2000 }) => {
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = texts[textIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setDisplayText(currentText.substring(0, charIndex + 1));
        setCharIndex(charIndex + 1);
        if (charIndex + 1 === currentText.length) {
          setTimeout(() => setIsDeleting(true), pause);
        }
      } else {
        setDisplayText(currentText.substring(0, charIndex - 1));
        setCharIndex(charIndex - 1);
        if (charIndex - 1 === 0) {
          setIsDeleting(false);
          setTextIndex((textIndex + 1) % texts.length);
        }
      }
    }, isDeleting ? speed / 2 : speed);

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, textIndex, texts, speed, pause]);

  return (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400">
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
};

// ─── Live Call Demo Simulation ───
const LiveCallDemo = () => {
  const [stage, setStage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const conversation = [
    { role: 'ai', text: 'Hello! This is Priya from TechSolutions. Am I speaking with Mr. Sharma?', delay: 0 },
    { role: 'human', text: 'Yes, this is Sharma speaking.', delay: 2500 },
    { role: 'ai', text: 'Great! I\'m calling regarding our new cloud hosting plans. We have a special offer for businesses like yours — 50% off for the first 3 months.', delay: 2000 },
    { role: 'human', text: 'That sounds interesting. Tell me more about the features.', delay: 3500 },
    { role: 'ai', text: 'Absolutely! You get 99.9% uptime, free SSL, 24/7 support, and auto-scaling. Shall I send the details to your email?', delay: 2500 },
    { role: 'human', text: 'Yes, please send it to my email.', delay: 3000 },
    { role: 'ai', text: 'Perfect! I\'ll send it right away. Thank you for your time, Mr. Sharma. Have a great day!', delay: 2000 },
  ];

  useEffect(() => {
    if (!isPlaying) return;
    if (stage >= conversation.length) {
      setTimeout(() => { setStage(0); setIsPlaying(false); }, 3000);
      return;
    }
    const timer = setTimeout(() => setStage(s => s + 1), conversation[stage].delay + 1500);
    return () => clearTimeout(timer);
  }, [stage, isPlaying]);

  const startDemo = () => {
    setStage(0);
    setIsPlaying(true);
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Phone frame */}
      <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl shadow-indigo-500/20 border border-gray-700">
        <div className="bg-gray-950 rounded-[2rem] overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-2 text-white text-xs">
            <span>9:41</span>
            <div className="w-24 h-5 bg-gray-800 rounded-full mx-auto"></div>
            <span>100%</span>
          </div>

          {/* Call header */}
          <div className="bg-gradient-to-b from-indigo-600 to-indigo-700 px-6 py-4 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full mx-auto mb-2 flex items-center justify-center">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <p className="text-white font-semibold text-lg">Akashvanni AI</p>
            <p className="text-indigo-200 text-sm flex items-center justify-center gap-1">
              {isPlaying ? (
                <><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Live Call</>
              ) : (
                'Tap Play to see demo'
              )}
            </p>
          </div>

          {/* Conversation */}
          <div className="bg-gray-100 px-4 py-4 min-h-[280px] max-h-[280px] overflow-y-auto space-y-3">
            {!isPlaying && stage === 0 && (
              <div className="flex flex-col items-center justify-center h-[250px] text-gray-400">
                <button
                  onClick={startDemo}
                  className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-110 transition-all"
                >
                  <Play className="w-8 h-8 text-white ml-1" />
                </button>
                <p className="mt-4 text-sm font-medium">Watch AI Call Demo</p>
              </div>
            )}
            {conversation.slice(0, stage).map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'ai'
                    ? 'bg-white text-gray-800 shadow-sm rounded-bl-md'
                    : 'bg-indigo-600 text-white rounded-br-md'
                }`}>
                  {msg.role === 'ai' && <p className="text-[10px] font-bold text-indigo-600 mb-0.5">AI AGENT</p>}
                  {msg.text}
                </div>
              </div>
            ))}
            {isPlaying && stage < conversation.length && (
              <div className="flex justify-start">
                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Call controls */}
          <div className="bg-gray-200 px-6 py-4 flex items-center justify-center gap-6">
            <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
              <Mic className="w-5 h-5 text-gray-600" />
            </div>
            <button
              onClick={() => { if (isPlaying) { setIsPlaying(false); setStage(0); } else startDemo(); }}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${
                isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              } transition-colors`}
            >
              {isPlaying ? (
                <Phone className="w-7 h-7 text-white transform rotate-[135deg]" />
              ) : (
                <Phone className="w-7 h-7 text-white" />
              )}
            </button>
            <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
              <Headphones className="w-5 h-5 text-gray-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ─── FAQ Item ───
const FAQItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 pr-4">{question}</span>
        {open ? <ChevronUp className="w-5 h-5 text-indigo-600 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-gray-600 leading-relaxed bg-white">
          {answer}
        </div>
      )}
    </div>
  );
};


// ─── MAIN LANDING PAGE ───
const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">

      {/* ══════════════════ NAVBAR ══════════════════ */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Akashvanni" className="h-9 sm:h-10 w-auto" />
              <span className={`text-xl font-bold hidden sm:block ${isScrolled ? 'text-gray-900' : 'text-white'}`}>
                Akashvanni
              </span>
            </div>
            <div className={`hidden md:flex items-center gap-8 text-sm font-medium ${isScrolled ? 'text-gray-700' : 'text-white/90'}`}>
              <a href="#features" className="hover:text-indigo-500 transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-indigo-500 transition-colors">How It Works</a>
              <a href="#pricing" className="hover:text-indigo-500 transition-colors">Pricing</a>
              <a href="#use-cases" className="hover:text-indigo-500 transition-colors">Use Cases</a>
              <a href="#faq" className="hover:text-indigo-500 transition-colors">FAQ</a>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  isScrolled ? 'text-gray-700 hover:text-indigo-600' : 'text-white/90 hover:text-white'
                }`}
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold text-sm hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30"
              >
                Start Free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative min-h-screen flex items-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-3xl"></div>
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0wIDEwYzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 sm:py-40">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — Copy */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-white/80 text-sm font-medium">Now with Hindi & English AI Voice</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight">
                AI Voice Calls That<br />
                <TypewriterText
                  texts={['Close Deals', 'Generate Leads', 'Book Appointments', 'Qualify Prospects', 'Recover Payments']}
                />
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-indigo-100/80 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Automate outbound calls with human-like AI agents. Upload your script,
                dial thousands of numbers, and let AI handle the conversation — in <strong className="text-white">Hindi & English</strong>.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Link
                  to="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-bold text-lg hover:from-orange-600 hover:to-pink-600 transition-all shadow-xl shadow-orange-500/25 hover:shadow-2xl hover:shadow-orange-500/30 hover:-translate-y-0.5"
                >
                  Start Calling Now <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="#demo"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-xl font-semibold text-lg hover:bg-white/20 transition-all"
                >
                  <Play className="w-5 h-5" /> Watch Demo
                </a>
              </div>

              {/* Trust badges */}
              <div className="mt-12 flex items-center gap-8 justify-center lg:justify-start text-indigo-200/60 text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Enterprise-grade</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>Setup in 2 min</span>
                </div>
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4" />
                  <span>Pay-per-use</span>
                </div>
              </div>
            </div>

            {/* Right — Live Demo */}
            <div id="demo" className="flex justify-center lg:justify-end">
              <LiveCallDemo />
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,64 C480,120 960,0 1440,64 L1440,120 L0,120 Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* ══════════════════ STATS BAR ══════════════════ */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 10000, suffix: '+', label: 'Calls Made', prefix: '' },
              { value: 500, suffix: '+', label: 'Happy Businesses', prefix: '' },
              { value: 95, suffix: '%', label: 'Call Completion', prefix: '' },
              { value: 7, suffix: '+', label: 'AI Voices', prefix: '' },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-3xl sm:text-4xl font-extrabold text-indigo-600">
                  <AnimatedCounter end={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
                </div>
                <p className="mt-1 text-gray-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ FEATURES ══════════════════ */}
      <section id="features" className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-indigo-600 font-bold text-sm uppercase tracking-wider">Why Akashvanni</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Everything You Need for AI-Powered Calling
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              From single calls to bulk campaigns — automate your entire outbound calling with intelligent AI agents.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Bot, bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600',
                title: 'Human-Like AI Agent',
                desc: 'Our AI speaks naturally with real-time understanding. Customers can\'t tell it\'s not human — handles objections, answers questions, and follows your script intelligently.'
              },
              {
                icon: Globe2, bgColor: 'bg-purple-100', iconColor: 'text-purple-600',
                title: 'Hindi & English Support',
                desc: 'Speak to your customers in the language they prefer. Switch seamlessly between Hindi and English with native-sounding AI voices.'
              },
              {
                icon: Megaphone, bgColor: 'bg-pink-100', iconColor: 'text-pink-600',
                title: 'Bulk Campaign Dialer',
                desc: 'Upload a CSV with thousands of phone numbers and launch a campaign. AI calls each number, has the conversation, and reports results — automatically.'
              },
              {
                icon: FileText, bgColor: 'bg-orange-100', iconColor: 'text-orange-600',
                title: 'Custom Knowledge Base',
                desc: 'Upload your product docs, FAQs, or scripts. The AI learns your business and answers customer questions accurately using your own content.'
              },
              {
                icon: BarChart3, bgColor: 'bg-cyan-100', iconColor: 'text-cyan-600',
                title: 'Smart Lead Analytics',
                desc: 'Every call is analyzed — leads are automatically tagged as Hot, Warm, or Cold. Get full transcripts, summaries, and sentiment analysis.'
              },
              {
                icon: Mic, bgColor: 'bg-emerald-100', iconColor: 'text-emerald-600',
                title: '7+ Natural Voices',
                desc: 'Choose from multiple male and female voices — Anushka, Vidya, Abhilash, Karun, and more. Pick the voice that matches your brand.'
              },
              {
                icon: Clock, bgColor: 'bg-amber-100', iconColor: 'text-amber-600',
                title: 'Schedule Campaigns',
                desc: 'Schedule your campaigns for the perfect time. Set date and time, and the AI starts calling automatically — even while you sleep.'
              },
              {
                icon: Zap, bgColor: 'bg-rose-100', iconColor: 'text-rose-600',
                title: 'Real-Time Streaming',
                desc: 'Ultra-low latency voice streaming via Twilio + Deepgram. The AI responds in milliseconds — no awkward pauses, no robotic delays.'
              },
              {
                icon: Shield, bgColor: 'bg-violet-100', iconColor: 'text-violet-600',
                title: 'Enterprise Security',
                desc: 'Bank-grade encryption, secure payment via Razorpay, email-verified accounts, and role-based access. Your data stays safe.'
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="group bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-indigo-100 hover:-translate-y-1"
              >
                <div className={`w-14 h-14 rounded-2xl ${feature.bgColor} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-indigo-600 font-bold text-sm uppercase tracking-wider">Simple Process</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Start Making AI Calls in 3 Steps
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              No coding, no complex setup. Go from sign-up to your first AI call in under 2 minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                step: '01',
                title: 'Upload Your Script',
                desc: 'Upload your product info, FAQ, or sales pitch as a document. Our AI learns everything about your offering instantly.',
                icon: FileText,
              },
              {
                step: '02',
                title: 'Add Phone Numbers',
                desc: 'Enter a single number or upload a CSV with thousands. Choose language, voice, and set your welcome message.',
                icon: PhoneCall,
              },
              {
                step: '03',
                title: 'AI Makes the Calls',
                desc: 'Hit Start. The AI dials every number, has intelligent conversations, handles objections, and reports back with analytics.',
                icon: TrendingUp,
              },
            ].map((item, i) => (
              <div key={i} className="relative text-center group">
                {i < 2 && (
                  <div className="hidden md:block absolute top-16 left-[60%] w-[80%] border-t-2 border-dashed border-indigo-200"></div>
                )}
                <div className="relative z-10 w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl flex flex-col items-center justify-center group-hover:from-indigo-100 group-hover:to-purple-100 transition-colors border border-indigo-100">
                  <span className="text-xs font-bold text-indigo-400 mb-1">STEP</span>
                  <span className="text-3xl font-extrabold text-indigo-600">{item.step}</span>
                </div>
                <item.icon className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed max-w-sm mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ USE CASES ══════════════════ */}
      <section id="use-cases" className="py-20 sm:py-28 bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-indigo-300 font-bold text-sm uppercase tracking-wider">Use Cases</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight">
              Built for Every Business That Makes Calls
            </h2>
            <p className="mt-4 text-lg text-indigo-200/70">
              Whether you're a startup or an enterprise — if you need to call people, Akashvanni does it better.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Lead Generation', desc: 'Call thousands of prospects, qualify leads, and identify hot opportunities — all on autopilot.', emoji: '🎯' },
              { title: 'Appointment Booking', desc: 'AI calls patients, clients, or customers to book, confirm, or reschedule appointments.', emoji: '📅' },
              { title: 'Payment Reminders', desc: 'Gentle, professional payment reminder calls. AI handles objections and logs payment promises.', emoji: '💰' },
              { title: 'Customer Surveys', desc: 'Collect feedback at scale. AI conducts phone surveys and records responses automatically.', emoji: '📊' },
              { title: 'Real Estate', desc: 'Call property leads, share listings, schedule site visits — the AI agent does it all.', emoji: '🏠' },
              { title: 'EdTech & Coaching', desc: 'Follow up with course inquiries, share batch details, and convert interested students.', emoji: '🎓' },
            ].map((uc, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all hover:-translate-y-1">
                <span className="text-4xl">{uc.emoji}</span>
                <h3 className="mt-4 text-xl font-bold">{uc.title}</h3>
                <p className="mt-3 text-indigo-200/70 leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ PRICING ══════════════════ */}
      <section id="pricing" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-indigo-600 font-bold text-sm uppercase tracking-wider">Simple Pricing</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Pay Only for What You Use
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              No monthly fees, no hidden charges. Recharge your wallet, make calls, done.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="relative bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-10 text-white text-center shadow-2xl shadow-indigo-500/20 overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

              <div className="relative z-10">
                <span className="inline-block bg-white/20 rounded-full px-4 py-1 text-sm font-semibold mb-6">PAY-AS-YOU-GO</span>

                <div className="flex items-center justify-center gap-1">
                  <span className="text-5xl sm:text-7xl font-extrabold">&#8377;1</span>
                  <div className="text-left ml-2">
                    <span className="text-xl sm:text-2xl font-bold text-indigo-200">per</span><br />
                    <span className="text-xl sm:text-2xl font-bold text-indigo-200">10 sec</span>
                  </div>
                </div>

                <p className="mt-4 text-indigo-200 text-lg">That's just &#8377;6/minute</p>

                <div className="mt-8 space-y-4 text-left max-w-sm mx-auto">
                  {[
                    'No monthly subscription',
                    'No setup fees',
                    'Wallet-based — recharge anytime',
                    'GST invoice on every recharge',
                    'Unused balance never expires',
                    'All voices & languages included',
                    'Bulk campaigns included',
                    'Full analytics & transcripts',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span className="text-white/90">{item}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/signup"
                  className="mt-10 inline-flex items-center justify-center gap-2 px-10 py-4 bg-white text-indigo-700 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-all shadow-xl w-full sm:w-auto"
                >
                  Get Started Free <ArrowRight className="w-5 h-5" />
                </Link>
                <p className="mt-3 text-indigo-300 text-sm">No credit card required</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ TESTIMONIALS ══════════════════ */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-indigo-600 font-bold text-sm uppercase tracking-wider">Testimonials</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Trusted by Growing Businesses
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: 'Akashvanni saved us 40+ hours per week on cold calling. The AI agent sounds so natural — our leads don\'t even realize they\'re talking to AI.',
                name: 'Rajesh Gupta',
                role: 'CEO, PropertyDekho',
                stars: 5,
              },
              {
                quote: 'We run Hindi campaigns for our coaching institute. The AI calls students, explains course details, and books demo classes — all automatically!',
                name: 'Priya Sharma',
                role: 'Founder, LearnFirst Academy',
                stars: 5,
              },
              {
                quote: 'The pay-per-use pricing is perfect for us. We only pay for calls we make. No expensive subscriptions. The analytics dashboard is a bonus.',
                name: 'Amit Patel',
                role: 'Sales Head, FinServe Solutions',
                stars: 5,
              },
            ].map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow">
                <div className="flex gap-1 mb-4">
                  {Array(t.stars).fill(0).map((_, j) => (
                    <Star key={j} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed mb-6 italic">"{t.quote}"</p>
                <div>
                  <p className="font-bold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ FAQ ══════════════════ */}
      <section id="faq" className="py-20 sm:py-28 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-indigo-600 font-bold text-sm uppercase tracking-wider">FAQ</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            <FAQItem
              question="What is Akashvanni?"
              answer="Akashvanni is an AI-powered voice calling platform that lets businesses automate outbound phone calls. Our AI agents can make sales calls, generate leads, book appointments, send payment reminders, and more — in both Hindi and English."
            />
            <FAQItem
              question="How does the AI voice call work?"
              answer="You upload your product information or sales script as a document. Then you enter a phone number or upload a CSV with thousands of numbers. The AI calls each number, has a natural conversation based on your script, handles objections, answers questions, and reports back with full transcripts and lead scoring."
            />
            <FAQItem
              question="Can the AI speak Hindi?"
              answer="Yes! Akashvanni supports both Hindi and English with multiple natural-sounding voices. You can choose from 7+ voices including male and female options like Anushka, Vidya, Abhilash, and more."
            />
            <FAQItem
              question="How much does it cost?"
              answer="We use simple pay-as-you-go pricing at ₹1 per 10 seconds of call time (₹6/minute). No monthly fees, no setup charges. Just recharge your wallet and start calling. GST invoice is generated on every recharge."
            />
            <FAQItem
              question="How many calls can I make at once?"
              answer="With Bulk Campaigns, you can upload thousands of phone numbers in a CSV file. The AI will call each number sequentially, have the conversation, and move to the next. You can also schedule campaigns for a specific date and time."
            />
            <FAQItem
              question="Do I need any technical knowledge?"
              answer="Not at all! Akashvanni is designed for non-technical users. Just sign up, upload your script, enter phone numbers, and click Start. The entire process takes less than 2 minutes."
            />
            <FAQItem
              question="Is my data secure?"
              answer="Absolutely. We use bank-grade encryption, secure payments via Razorpay, email-verified accounts, and strict access controls. Your call data, transcripts, and business information are fully protected."
            />
            <FAQItem
              question="Can I try before I pay?"
              answer="Yes! Sign up for free and explore the platform. You can recharge with as little as ₹10 to test your first AI call."
            />
          </div>
        </div>
      </section>

      {/* ══════════════════ FINAL CTA ══════════════════ */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Ready to Automate Your Calls?
          </h2>
          <p className="mt-6 text-xl text-indigo-100/80 max-w-2xl mx-auto">
            Join hundreds of businesses using Akashvanni to make smarter, faster, and cheaper outbound calls with AI.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 bg-white text-indigo-700 rounded-xl font-bold text-lg hover:bg-indigo-50 transition-all shadow-xl"
            >
              Start Calling Now <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <p className="mt-4 text-indigo-200/60 text-sm">Free sign-up. No credit card needed. Pay only when you call.</p>
        </div>
      </section>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <footer className="bg-gray-950 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.png" alt="Akashvanni" className="h-8 w-auto" />
                <span className="text-white text-xl font-bold">Akashvanni</span>
              </div>
              <p className="text-gray-500 leading-relaxed max-w-md">
                AI-powered voice calling platform for businesses. Automate outbound calls, generate leads, and close deals with human-like AI agents in Hindi & English.
              </p>
              <p className="mt-4 text-gray-600 text-sm">A product by TWOZERO</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#use-cases" className="hover:text-white transition-colors">Use Cases</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Get Started</h4>
              <ul className="space-y-3 text-sm">
                <li><Link to="/signup" className="hover:text-white transition-colors">Sign Up Free</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
                <li><a href="mailto:admin@akashvanni.com" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">&copy; {new Date().getFullYear()} Akashvanni. All rights reserved.</p>
            <p className="text-sm text-gray-600">Made with AI in India</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
