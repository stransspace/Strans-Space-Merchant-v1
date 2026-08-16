import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Check,
  Copy,
  Lightbulb,
  MessageSquare,
  Moon,
  RotateCcw,
  Send,
  Sparkles,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../lib/language-context';

const QUICK_CHIPS = [
  "📊 Analisis omset hari ini",
  "⚠️ Cek stok bahan menipis",
  "📈 Bandingkan 3 outlet",
  "💡 Rekomendasi promo menu",
  "🛡️ Status kas & audit kasir",
];

/**
 * Komponen pemformat pesan AI agar rapi, berstruktur, dan mudah dibaca (Skimmable).
 */
function FormattedMessage({ text }) {
  const lines = text.split("\n");
  const renderedElements = [];

  let inCallout = false;
  let calloutLines = [];

  function flushCallout(key) {
    if (calloutLines.length > 0) {
      renderedElements.push(
        <div
          key={`callout-${key}`}
          className="my-3 rounded-xl border border-amber-300/40 bg-amber-50/80 p-3.5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200 shadow-xs text-xs"
        >
          <div className="flex items-start gap-2.5">
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1 text-xs">
              {calloutLines.map((cLine, cIdx) => (
                <p key={cIdx} className="leading-relaxed">
                  {renderInlineFormattedText(cLine)}
                </p>
              ))}
            </div>
          </div>
        </div>
      );
      calloutLines = [];
      inCallout = false;
    }
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inCallout) {
        flushCallout(`flush-${index}`);
      }
      return;
    }

    // Deteksi Callout Saran Aksi / Rekomendasi
    if (
      trimmed.startsWith("💡 **Saran") ||
      trimmed.startsWith("🚚 **Saran") ||
      trimmed.startsWith("🎁 **Rekomendasi") ||
      trimmed.startsWith("💡 Saran")
    ) {
      if (inCallout) flushCallout(`prev-${index}`);
      inCallout = true;
      calloutLines.push(trimmed);
      return;
    }

    if (inCallout) {
      calloutLines.push(trimmed);
      return;
    }

    // Judul Bagian Utama (dimulai dengan emoji atau **)
    if (
      (trimmed.startsWith("📊") ||
        trimmed.startsWith("⚠️") ||
        trimmed.startsWith("📈") ||
        trimmed.startsWith("💡") ||
        trimmed.startsWith("🛡️") ||
        trimmed.startsWith("🤖") ||
        trimmed.startsWith("🌟") ||
        trimmed.startsWith("🚨")) &&
      !trimmed.includes("•")
    ) {
      renderedElements.push(
        <div
          key={`header-${index}`}
          className="font-heading text-xs sm:text-sm font-bold tracking-tight text-[var(--color-ink)] pb-1.5 pt-1 border-b border-[var(--color-hairline)]"
        >
          {renderInlineFormattedText(trimmed)}
        </div>
      );
      return;
    }

    // Bullet points (• atau -)
    if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
      const content = trimmed.replace(/^[•-]\s*/, "");
      renderedElements.push(
        <div key={`bullet-${index}`} className="flex items-start gap-2 text-xs leading-relaxed py-0.5">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand-500)]" />
          <span className="flex-1 text-[var(--color-ink)]">{renderInlineFormattedText(content)}</span>
        </div>
      );
      return;
    }

    // Numbered item (1., 2., 3.)
    const numberMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
    if (numberMatch) {
      const num = numberMatch[1];
      const rest = numberMatch[2];
      renderedElements.push(
        <div key={`num-${index}`} className="flex items-start gap-2 text-xs leading-relaxed py-0.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-snow)] font-bold text-[10px] text-[var(--color-slate-muted)] mt-0.5">
            {num}
          </span>
          <span className="flex-1 text-[var(--color-ink)]">{renderInlineFormattedText(rest)}</span>
        </div>
      );
      return;
    }

    // Regular line
    renderedElements.push(
      <p key={`p-${index}`} className="text-xs leading-relaxed py-0.5 text-[var(--color-ink)]">
        {renderInlineFormattedText(trimmed)}
      </p>
    );
  });

  if (inCallout) {
    flushCallout("final");
  }

  return <div className="space-y-1">{renderedElements}</div>;
}

/**
 * Parsing teks tebal (**text**) dan miring (*text*)
 */
function renderInlineFormattedText(text) {
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      const boldText = token.slice(2, -2);
      const isMetric = boldText.includes("Rp") || boldText.includes("%") || boldText.includes("kg") || boldText.includes("Liter");
      parts.push(
        <strong
          key={match.index}
          className={cn(
            "font-bold text-[var(--color-ink)]",
            isMetric && "text-[var(--color-brand-600)] dark:text-[var(--color-brand-400)] font-black"
          )}
        >
          {boldText}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={match.index} className="text-[var(--color-slate-muted)] font-normal not-italic opacity-90">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export function AICopilotWidget() {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'whatsapp'
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [ownerPhone, setOwnerPhone] = useState('081234567890');
  const [digestTime, setDigestTime] = useState('22:00');
  const [toastMsg, setToastMsg] = useState(null);

  const chatEndRef = useRef(null);
  const messageSeq = useRef(0);
  const nextMessageId = (prefix) => `${prefix}-${(messageSeq.current += 1)}`;

  const initialMessages = [
    {
      id: "m-welcome",
      sender: "ai",
      text: language === 'en'
        ? `🤖 **Hello Juragan! I am Strans AI Copilot**

I am ready to analyze sales performance across all outlets, monitor critical raw material stock, and provide business recommendations for today.

Please pick one of the quick suggestions below or type your business question.`
        : `🤖 **Halo Juragan! Saya Strans AI Copilot**

Saya siap membantu menganalisis omset 3 outlet, mengawasi sisa stok bahan baku kritis, dan memberi rekomendasi strategi penjualan hari ini.

Silakan pilih salah satu pertanyaan cepat di bawah atau ketik pertanyaan bisnis Anda.`,
      time: "Baru saja",
    },
  ];

  const [messages, setMessages] = useState(initialMessages);

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, isTyping]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSend = (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isTyping) return;

    const userMsg = {
      id: nextMessageId("user"),
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsTyping(true);

    setTimeout(() => {
      let reply = `⚠️ **Ringkasan Operasional Hari Ini**\n\n• **Total Omset**: **Rp 28.450.000** *(94.8% target holding)*\n• **Cabang Terbaik**: Kopi Cisauk (Tangerang)\n• **Peringatan Stok**: Biji Kopi di Dago (Bandung) tersisa **1.2 kg**.\n\n💡 **Saran Aksi:** Segera setujui permohonan restock biji kopi gudang pusat sebelum jam 14.00.`;

      const lower = query.toLowerCase();
      if (lower.includes('omset') || lower.includes('sales') || lower.includes('analisis')) {
        reply = `📊 **Analisis Omset Hari Ini:**\n\n• **Total Penjualan**: **Rp 30.815.570** *(+18% vs minggu lalu)*\n• **Rata-rata per Transaksi**: **Rp 52.948**\n• **Jam Tersibuk**: Pukul 14:00 - 16:30 WIB\n\n💡 **Saran Aksi:** Tingkatkan stok cup takeaway di outlet Tangerang karena tren take-away melonjak 34% sore ini.`;
      } else if (lower.includes('stok') || lower.includes('bahan')) {
        reply = `⚠️ **Peringatan Stok Bahan Baku Kritis:**\n\n• **Biji Kopi Arabica**: Sisa **1.2 kg** di Dago (estimasi habis 4 jam)\n• **Susu Fresh UHT**: Sisa **4 Liter** di Cisauk\n• **Sirup Karamel**: Sisa **2 Botol**\n\n💡 **Saran Aksi:** Batch produksi baru dari Gudang Pusat sedang transit dengan kode tracking **STRANS-LOG-8821**.`;
      } else if (lower.includes('banding') || lower.includes('outlet')) {
        reply = `📈 **Perbandingan Kinerja Outlet:**\n\n1. **Kopi Cisauk (Tangerang)**: **Rp 18.250.000** (59.2% kontribusi holding, 0% void)\n2. **Kopi Bandung (Dago)**: **Rp 12.565.570** (40.8% kontribusi holding, 0% void)\n\n💡 **Saran Aksi:** Outlet Bandung memiliki potensi menu pastry lebih tinggi saat jam santai malam.`;
      } else if (lower.includes('promo') || lower.includes('menu')) {
        reply = `💡 **Rekomendasi Strategi Menu & Promo:**\n\n• **Kopi Susu Aren Signature**: Margin tertinggi (**72%**)\n• **Bundling Rekomendasi**: Padukan Kopi Susu Aren + Croissant dengan diskon 10% untuk menaikkan basket size dari Rp 52k ke Rp 68k.\n\n💡 **Saran Aksi:** Anda dapat mengaktifkan kode voucher otomatis di menu Promo & Voucher.`;
      } else if (lower.includes('kas') || lower.includes('audit') || lower.includes('kasir')) {
        reply = `🛡️ **Status Kas & Deteksi Fraud Kasir:**\n\n• **Saldo Kas Laci (Drawer)**: Sesuai balance (**Rp 1.450.000**)\n• **Tingkat Transaksi Void**: **0 Transaksi** (Aman)\n• **Metode QRIS Terverifikasi**: 100% settlement otomatis tanpa selisih.`;
      }

      const aiMsg = {
        id: nextMessageId("ai"),
        sender: "ai",
        text: reply,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 600);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(language === 'en' ? 'Answer copied to clipboard' : 'Jawaban berhasil disalin');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages(initialMessages);
    showToast(language === 'en' ? 'Chat history reset' : 'Riwayat percakapan dibersihkan');
  };

  const handleSendTestWhatsApp = () => {
    let cleanPhone = ownerPhone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith("8")) {
      cleanPhone = "62" + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 9) {
      showToast("Nomor WhatsApp belum valid");
      return;
    }

    const messageLines = [
      "🌙 *Rekap Malam, Kopi & Ruang Juragan!*",
      `📅 Rekap Tutup Toko • ${digestTime || "22:00"} WIB`,
      "",
      "📊 HARI INI",
      "💰 Penjualan: *Rp 30.815.570*",
      "🛒 Jumlah transaksi: 305",
      "🧾 Rata-rata per transaksi: Rp 52.948",
      "📈 +18,2% dibanding kemarin",
      "",
      "📊 MINGGU INI",
      "💰 Penjualan: *Rp 184.200.000*",
      "📈 +8,1% dibanding minggu lalu",
      "",
      "💳 Metode Pembayaran",
      "QRIS 58% • Tunai 27% • Transfer 15%",
      "",
      "📦 Margin kotor: 64,8%",
      "🏆 Paling laku: Kopi Susu Aren (420 porsi)",
      "⚠️ Stok menipis: Biji Kopi di Dago (sisa 1.2 kg)",
      "",
      "Semangat bisnis untuk besok! 🚀",
      "_Strans Space_",
    ];

    const messageText = messageLines.join("\n");
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(messageText)}`;
    
    showToast(`Membuka WhatsApp ke nomor +${cleanPhone}...`);
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {/* Floating Pill Button in Bottom-Right Corner */}
      <aside aria-label="Juragan AI Assistant" className="fixed bottom-6 right-6 z-50 select-none">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex items-center gap-3 rounded-full p-2.5 pr-5 text-white shadow-2xl transition-all duration-300 bg-gradient-to-r from-violet-600 via-indigo-600 to-[var(--color-brand-600)] hover:scale-105 hover:shadow-[0_12px_28px_rgba(124,58,237,0.45)] active:scale-95 cursor-pointer ring-4 ring-white/40 dark:ring-slate-900/60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
            <Sparkles className="h-4.5 w-4.5 animate-pulse text-amber-300" />
          </span>
          <span className="flex flex-col text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-200 leading-none">
              JURAGAN AI
            </span>
            <span className="text-sm font-black leading-tight text-white mt-0.5">
              Strans Copilot
            </span>
          </span>
          <span className="flex h-2.5 w-2.5 items-center justify-center ml-1">
            <span className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
          </span>
        </button>
      </aside>

      {/* Main Copilot Dialog (Matching Strans Space v2 Exactly) */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="max-w-4xl">
        <div className="overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--card)] shadow-2xl">
          {/* Header with Dark Purple / Violet Gradient */}
          <div className="flex items-center justify-between border-b border-[var(--color-hairline)] bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-950 p-4 sm:p-5 text-white">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md ring-1 ring-white/20 shadow-2xs">
                <Bot className="h-6 w-6 text-amber-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-black text-white leading-tight">
                    Strans AI Copilot
                  </DialogTitle>
                  <Badge variant="brand" className="bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40 text-[10px] px-2 py-0.5 font-bold">
                    👑 Asisten Owner
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-violet-200 mt-0.5 truncate">
                  Analisis pintar omset, stok bahan menipis, dan rekomendasi strategi bisnis
                </DialogDescription>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl p-1.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
              title="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Sub-tabs Bar */}
          <div className="flex items-center justify-between border-b border-[var(--color-hairline)] bg-[var(--color-snow)] px-4 sm:px-5">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer",
                  activeTab === "chat"
                    ? "border-[var(--color-brand-600)] text-[var(--color-brand-700)] dark:border-[var(--color-brand-400)] dark:text-[var(--color-brand-300)]"
                    : "border-transparent text-[var(--color-slate-muted)] hover:text-[var(--color-ink)]"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                <span>Tanya Bisnis (AI Chat)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("whatsapp")}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer",
                  activeTab === "whatsapp"
                    ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                    : "border-transparent text-[var(--color-slate-muted)] hover:text-[var(--color-ink)]"
                )}
              >
                <Moon className="h-4 w-4 text-emerald-500" />
                <span>WhatsApp Nightly Digest</span>
              </button>
            </div>

            {activeTab === "chat" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetChat}
                className="h-8 gap-1.5 px-2.5 text-xs text-[var(--color-slate-muted)] hover:text-[var(--color-ink)] font-medium cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reset Chat</span>
              </Button>
            )}
          </div>

          {/* TAB 1: Chatbot Interface */}
          {activeTab === "chat" && (
            <div className="flex h-[500px] sm:h-[540px] flex-col">
              {/* Message List */}
              <div className="scroll-slim flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex gap-3",
                      m.sender === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {m.sender === "ai" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xs mt-0.5">
                        <Sparkles className="h-4 w-4" />
                      </div>
                    )}

                    <div className="max-w-[88%] sm:max-w-[82%] space-y-1.5">
                      <div
                        className={cn(
                          "group relative rounded-2xl p-4 text-xs sm:text-sm leading-relaxed",
                          m.sender === "user"
                            ? "bg-[var(--color-brand-600)] text-white shadow-xs rounded-tr-none font-medium"
                            : "border border-[var(--color-hairline)] bg-[var(--card)] text-[var(--color-ink)] shadow-2xs rounded-tl-none"
                        )}
                      >
                        {m.sender === "ai" ? (
                          <FormattedMessage text={m.text} />
                        ) : (
                          <p className="whitespace-pre-line break-words">{m.text}</p>
                        )}

                        {m.sender === "ai" && (
                          <div className="mt-3 flex items-center justify-end border-t border-[var(--color-hairline)]/60 pt-2 text-xs text-[var(--color-slate-muted)]">
                            <button
                              type="button"
                              onClick={() => handleCopy(m.text, m.id)}
                              className="flex items-center gap-1.5 hover:text-[var(--color-ink)] transition-colors font-medium text-[11px] px-2 py-1 rounded-md hover:bg-[var(--color-snow)] cursor-pointer"
                              title="Salin jawaban"
                            >
                              {copiedId === m.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              <span>{copiedId === m.id ? "Disalin" : "Salin"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-[10px] text-[var(--color-slate-muted)] px-1.5 font-medium",
                          m.sender === "user" ? "text-right" : "text-left"
                        )}
                      >
                        {m.time}
                      </p>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xs">
                      <Sparkles className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="rounded-2xl rounded-tl-none border border-[var(--color-hairline)] bg-[var(--card)] p-3.5 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-violet-600" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-600 [animation-delay:0.2s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-brand-500)] [animation-delay:0.4s]" />
                        <span className="ml-2 text-xs text-[var(--color-slate-muted)] font-medium">
                          Sedang menganalisa data bisnis holding...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Chip Suggestions */}
              <div className="flex gap-2 overflow-x-auto border-t border-[var(--color-hairline)] bg-[var(--color-snow)] px-4 py-2.5 scroll-slim">
                {QUICK_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isTyping}
                    onClick={() => handleSend(chip)}
                    className="shrink-0 rounded-full border border-[var(--color-hairline)] bg-[var(--card)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink)] transition-colors hover:border-[var(--color-brand-500)] hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-700)] dark:hover:bg-[var(--color-brand-950)]/50 dark:hover:text-[var(--color-brand-300)] disabled:opacity-50 shadow-2xs cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2.5 border-t border-[var(--color-hairline)] bg-[var(--card)] p-3.5 sm:p-4"
              >
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Tanya omset, stok kritis, perbandingan outlet, atau ide promo..."
                  disabled={isTyping}
                  className="h-11 text-xs sm:text-sm px-4 bg-[var(--card)]"
                />
                <Button
                  type="submit"
                  disabled={!inputMessage.trim() || isTyping}
                  className="h-11 gap-2 bg-gradient-to-r from-violet-600 to-[var(--color-brand-600)] text-white shrink-0 px-5 text-xs sm:text-sm font-bold shadow-2xs cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  <span>Kirim</span>
                </Button>
              </form>
            </div>
          )}

          {/* TAB 2: WhatsApp Nightly Digest */}
          {activeTab === "whatsapp" && (
            <div className="scroll-slim max-h-[540px] space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2.5">
                  <Moon className="h-5 w-5 text-emerald-600" />
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Otomatisasi Rekap Tutup Toko ke WhatsApp Owner
                  </h4>
                </div>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Setiap malam setelah kasir tutup buku, AI merangkum seluruh penjualan seluruh cabang dan mengirimkannya langsung ke nomor WhatsApp Anda.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                    Nomor WhatsApp Owner
                  </label>
                  <Input
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="h-10 text-xs sm:text-sm bg-[var(--card)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                    Jadwal Kirim Harian
                  </label>
                  <Input
                    value={digestTime}
                    onChange={(e) => setDigestTime(e.target.value)}
                    type="time"
                    className="h-10 text-xs sm:text-sm bg-[var(--card)]"
                  />
                </div>
              </div>

              {/* WhatsApp Live Preview Bubble */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-slate-muted)]">
                  Preview Pesan WhatsApp yang Diterima Owner:
                </label>
                <div className="rounded-2xl border border-[var(--color-hairline)] bg-[#ECE5DD] p-5 text-slate-900 dark:bg-slate-900/90 dark:text-slate-100 flex justify-center">
                  <div className="w-full max-w-sm rounded-2xl bg-white p-4 text-xs sm:text-sm shadow-md dark:bg-slate-800 dark:text-slate-100 space-y-3">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                        🌙 Rekap Malam, Kopi &amp; Ruang Juragan!
                      </p>
                      <p className="text-[11px] text-slate-500">
                        📅 Rekap Tutup Toko • {digestTime || "22:00"} WIB
                      </p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-bold uppercase tracking-wider text-slate-500">📊 HARI INI</p>
                      <p>💰 Penjualan: <strong className="text-slate-900 dark:text-white">Rp 30.815.570</strong></p>
                      <p>🛒 Jumlah transaksi: 305</p>
                      <p>🧾 Rata-rata per transaksi: Rp 52.948</p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-medium">📈 +18,2% dibanding kemarin</p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-bold uppercase tracking-wider text-slate-500">📊 MINGGU INI</p>
                      <p>💰 Penjualan: <strong className="text-slate-900 dark:text-white">Rp 184.200.000</strong></p>
                      <p className="text-emerald-600 dark:text-emerald-400 font-medium">📈 +8,1% dibanding minggu lalu</p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="font-bold uppercase tracking-wider text-slate-500">💳 Metode Pembayaran</p>
                      <p className="text-slate-500">QRIS 58% • Tunai 27% • Transfer 15%</p>
                    </div>

                    <div className="space-y-1 text-xs border-t border-slate-100 dark:border-slate-700 pt-2">
                      <p>📦 Margin kotor: <strong>64,8%</strong></p>
                      <p>🏆 Paling laku: <strong>Kopi Susu Aren (420 porsi)</strong></p>
                      <p className="text-amber-600 dark:text-amber-400">⚠️ Stok menipis: <strong>Biji Kopi di Dago (sisa 1.2 kg)</strong></p>
                    </div>

                    <div className="pt-1 text-[11px] text-slate-500">
                      <p>Semangat bisnis untuk besok! 🚀</p>
                      <p className="text-[10px] italic text-slate-400">Strans Space</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--color-hairline)]">
                <p className="text-xs text-[var(--color-slate-muted)]">
                  *Pesan akan terbuka langsung di aplikasi WhatsApp / WhatsApp Web Anda.
                </p>
                <Button
                  type="button"
                  onClick={handleSendTestWhatsApp}
                  className="gap-2 text-xs sm:text-sm h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm shrink-0 cursor-pointer w-full sm:w-auto"
                >
                  <Send className="h-4 w-4" />
                  <span>Kirim Pesan ke WhatsApp Saya</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Small Floating Toast feedback */}
        {toastMsg && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-60 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xl animate-in fade-in">
            {toastMsg}
          </div>
        )}
      </Dialog>
    </>
  );
}
