import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { transactionsApi, accountsApi, Transaction, Account } from '../src/services/api';
import { useCustomization } from '../src/context/CustomizationContext';
import { useAuth } from '../src/context/AuthContext';
import { getChatbotName, getFooterTagline } from '../src/context/BankThemes';
import { lookupBank } from '../src/services/bank-lookup';
import RichMessage from '../src/components/RichMessage';
import TypingDots from '../src/components/TypingDots';
import BackButton from '../src/components/BackButton';
import { downloadReceipt } from '../src/services/offline-docs';

const C = { white: '#FFFFFF', lightGray: '#F2F2F2', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', bg: '#F5F5F5', bubbleBg: '#FFFFFF', userBubbleText: '#FFFFFF' };

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Optional inline action button rendered below the bubble.
   *  Currently only "send-pdf" is used, which triggers a receipt export
   *  for the most recent outgoing transfer. */
  action?: 'send-pdf';
  /** Attached transaction (for send-pdf action) */
  txnId?: string;
}

const QUICK_ACTIONS = [
  { label: 'Last Transaction', icon: 'receipt-outline', message: 'Show me my last transaction' },
  { label: 'Transfer Delays', icon: 'time-outline', message: 'Is there a problem with my transfer?' },
  { label: 'International Transfer Time', icon: 'globe-outline', message: 'How long does an international transfer take?' },
  { label: 'Support Hours', icon: 'call-outline', message: 'What are your support hours?' },
];

export default function ChatScreen() {
  const { colors: cc, headerTextColor, bankThemeId } = useCustomization();
  const { user } = useAuth();
  const botName = getChatbotName(bankThemeId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txnRes, accRes] = await Promise.all([
        transactionsApi.getAll(20),
        accountsApi.getAll(),
      ]);
      setTransactions(txnRes.data);
      setAccounts(accRes.data);
    } catch (e) { console.error(e); }
  };

  const fmt = (v: number) => `£${v.toFixed(2)}`;
  const fmtDate = (ts: string) => new Date(ts).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const getScriptedResponse = (userMsg: string): string => {
    const msg = userMsg.toLowerCase();

    // "Is there a problem with my transfer?" / "check my transfer" —
    // reassurance response (user-provided script). Ellie pushes back with
    // TRN/FPID and quotes recipient-bank timings.
    // NOTE: This branch must run BEFORE the plain "last transaction" branch
    // so the quick actions can differentiate between the two intents.
    const isProblemIntent =
      /(problem|issue|wrong|missing|not receive|not received|didn['’]?t receive|hasn['’]?t (arrived|received)|where is|where's|check|verify|status|confirm|proof)/i.test(
        userMsg,
      );
    if (
      isProblemIntent &&
      (msg.includes('transfer') || (msg.includes('payment') && !msg.includes('receipt')))
    ) {
      // Find the most recent outgoing transaction so we can identify the
      // recipient bank and quote a realistic credit window.
      const lastOut = transactions.find(
        (t) => t.transaction_type === 'transfer' || t.transaction_type === 'payment'
      );
      // Prefer the actual FPID from the last transfer so the number Ellie
      // quotes matches the receipt. Fall back to a freshly generated one.
      const genFpid = () => {
        let out = '';
        for (let i = 0; i < 27; i++) out += Math.floor(Math.random() * 10);
        return out;
      };
      const fpid = (lastOut as any)?.fpid || genFpid();
      let bankTimingLine = '';
      if (lastOut) {
        const sc = (lastOut as any).recipient_sort_code || '';
        const explicitBank = (lastOut as any).recipient_bank_name || '';
        const lookup = sc ? lookupBank(sc) : null;
        const bankShort =
          (lookup?.bank?.shortName) || explicitBank.split(' ')[0] || 'the recipient bank';
        // Typical UK credit windows for Faster Payments (published guidance).
        const timings: Record<string, string> = {
          Monzo: 'usually credits within a few seconds',
          Starling: 'usually credits within a few seconds',
          Revolut: 'usually credits within a few seconds',
          Chase: 'usually credits within a few minutes',
          Barclays: 'usually credits within 2 hours',
          HSBC: 'usually credits within 2 hours',
          Lloyds: 'usually credits within 2 hours',
          NatWest: 'usually credits within 2 hours',
          RBS: 'usually credits within 2 hours',
          Halifax: 'usually credits within 2 hours',
          Santander: 'usually credits within 2 hours (sometimes end of day)',
          Nationwide: 'usually credits within 2 hours',
          TSB: 'usually credits within 2 hours',
          'Metro Bank': 'usually credits within 2 hours',
          Metro: 'usually credits within 2 hours',
        };
        const timing = timings[bankShort] || 'typically credits within 2 hours under Faster Payments';
        bankTimingLine =
          `\n\nBased on **${bankShort}**'s published timings, funds ${timing}. ` +
          `If it hasn't landed after that window, the recipient should check their pending/incoming payments and ask their bank to search for the FPID above.`;
      }

      return `It has definitely been debited from your account, so I can't see what the problem is. The transfer has been sent and should show in the recipient's account shortly.\n\n` +
        `If it helps, I have the **TRN/reference number** and a **PDF payment confirmation** that I can send to the recipient as proof of the transfer.\n\n` +
        `**FPID/**${fpid}` +
        bankTimingLine +
        `\n\n— ${botName}` +
        // Hidden marker consumed by sendMessage() to attach a "Send PDF" button.
        (lastOut ? `\n[[SEND_PDF:${lastOut.id}]]` : '');
    }

    // Last transaction / receipt
    if (msg.includes('last transaction') || msg.includes('recent transaction') || msg.includes('latest transaction') || msg.includes('receipt')) {
      if (transactions.length === 0) {
        return "You don't have any transactions yet. Once you make a transfer or payment, I'll be able to show you the details here.";
      }
      const txn = transactions[0];
      const type = txn.transaction_type === 'deposit' ? 'Deposit' : txn.transaction_type === 'payment' ? 'Bill Payment' : 'Transfer';
      const direction = txn.transaction_type === 'deposit' ? 'Received' : 'Sent';
      
      return `📋 **TRANSACTION RECEIPT**\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `\n` +
        `**${type}** — ${direction}\n` +
        `\n` +
        `**Amount:** ${txn.transaction_type === 'deposit' ? '+' : '-'}${fmt(txn.amount)}\n` +
        `**To:** ${txn.recipient_name || 'N/A'}\n` +
        (txn.recipient_sort_code ? `**Sort Code:** ${txn.recipient_sort_code}\n` : '') +
        (txn.recipient_account_number ? `**Account No.:** ${txn.recipient_account_number}\n` : '') +
        (txn.recipient_bank_name ? `**Bank:** ${txn.recipient_bank_name}\n` : '') +
        `**Description:** ${txn.description}\n` +
        `**Date:** ${fmtDate(txn.timestamp)}\n` +
        `**Time:** ${fmtTime(txn.timestamp)}\n` +
        `**Status:** ✅ ${txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}\n` +
        `**Reference:** ${txn.id.slice(0, 12).toUpperCase()}\n` +
        (txn.trn ? `**TRN:** ${txn.trn}\n` : '') +
        (txn.fpid ? `**FPID:** ${txn.fpid}\n` : '') +
        `\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${getFooterTagline(bankThemeId)}`;
    }

    // International transfers — detailed timing (research-backed).
    // This has to be matched BEFORE the generic "transfer delay" branch
    // below so a query like "how long does an international transfer take"
    // routes here instead of the domestic response.
    if (
      (msg.includes('international') || msg.includes('overseas') || msg.includes('abroad') || msg.includes('swift') || msg.includes('sepa') || msg.includes('foreign')) &&
      (msg.includes('transfer') || msg.includes('payment') || msg.includes('send money') || msg.includes('long') || msg.includes('time') || msg.includes('how'))
    ) {
      return `🌍 **International Transfer Timings**\n\n` +
        `International transfers typically take **longer than UK domestic** payments because they route through the SWIFT network (or SEPA for EUR) and go through multiple intermediary banks and compliance checks.\n\n` +
        `**Typical arrival times** (based on published UK bank guidance):\n` +
        `• **SEPA (Euro area)**: 1 business day, sometimes same-day\n` +
        `• **SWIFT (most currencies)**: 1–4 business days\n` +
        `• **Long-haul / exotic currencies**: up to 5 business days\n` +
        `• **CHAPS (same-day GBP wire, UK-only)**: same working day if sent before 3:30 PM\n\n` +
        `**Common reasons for extra delay:**\n` +
        `• Weekends & bank holidays in the sending *and* receiving country — these aren't counted as business days\n` +
        `• Intermediary/correspondent banks adding an extra hop (typical for USD via US correspondents)\n` +
        `• Compliance / anti-money-laundering screening on amounts over £10,000 (or lower for some corridors)\n` +
        `• Missing or incorrect IBAN, SWIFT/BIC or beneficiary details — this can bounce the payment back after 2–3 days\n` +
        `• Currency-conversion cut-off times — FX only trades on weekdays\n` +
        `• Public holidays in the destination country (e.g. Chinese New Year, Diwali, Ramadan Eid)\n\n` +
        `**Tips to speed things up:**\n` +
        `• Send **before 2:00 PM UK time** on a working day\n` +
        `• Double-check the IBAN and SWIFT/BIC — one wrong character delays everything\n` +
        `• For urgent payments, choose the **OUR** charge option so the beneficiary receives the full amount without deductions\n\n` +
        `You can track any international transfer you've sent from the receipt — look for the **TRN** and **FPID** reference numbers. — ${botName}`;
    }

    // Transfer delays (domestic + generic)
    if (msg.includes('transfer') && (msg.includes('delay') || msg.includes('long') || msg.includes('time') || msg.includes('how long'))) {
      return `⏱️ **Transfer Processing Times**\n\n` +
        `**Domestic (UK) Transfers:**\n` +
        `• Faster Payments: Instant - 2 hours\n` +
        `• Same-day: By 3:30 PM if submitted before 2:00 PM\n` +
        `• BACS: 1-2 business days\n\n` +
        `**International Transfers:**\n` +
        `• SWIFT: 3-5 business days\n` +
        `• Urgent (CHAPS): Same day (fee applies)\n\n` +
        `**Possible Delays:**\n` +
        `• Weekends & bank holidays\n` +
        `• Security checks on large amounts (£10,000+)\n` +
        `• Incorrect sort code/account number\n\n` +
        `Need help with a specific transfer? Just ask! — ${botName}`;
    }

    // Cancel payment / reverse
    if (msg.includes('cancel') || msg.includes('reverse') || msg.includes('stop payment') || msg.includes('recall') || msg.includes('get money back') || msg.includes('undo')) {
      return `⚠️ **Payment Cancellation**\n\n` +
        `Once a Faster Payment has been sent, it **cannot be cancelled or reversed** because funds are transferred almost instantly.\n\n` +
        `However, if the payment was made to the wrong account:\n\n` +
        `1. **Contact HSBC immediately** on 03457 404 404 to request a recall\n` +
        `2. You may need to **contact the recipient directly** to request a refund\n` +
        `3. HSBC will attempt to recover the funds on your behalf, but this is not guaranteed\n\n` +
        `**Timeframes:**\n` +
        `• Recall requests should be made within 24 hours\n` +
        `• The receiving bank has up to 20 working days to respond\n` +
        `• If the recipient agrees, funds are usually returned within 5 working days\n\n` +
        `Need me to help with anything else? — ${botName}`;
    }

    // Support hours
    if (msg.includes('support') || msg.includes('contact') || msg.includes('help') || msg.includes('hours') || msg.includes('phone')) {
      return `📞 **HSBC Support Channels**\n\n` +
        `**Phone Banking:**\n` +
        `• 03457 404 404 — Available 24/7\n` +
        `• From abroad: +44 1226 261 010\n\n` +
        `**Live Chat:**\n` +
        `• Mon-Fri: 8:00 AM - 8:00 PM\n` +
        `• Sat-Sun: 9:00 AM - 5:00 PM\n\n` +
        `**Branch Hours:**\n` +
        `• Mon-Fri: 9:00 AM - 5:00 PM\n` +
        `• Saturday: 9:00 AM - 1:00 PM\n` +
        `• Sunday: Closed\n\n` +
        `**Emergencies (Lost/Stolen Card):**\n` +
        `• 0800 783 7654 — 24/7\n\n` +
        `I'm also here to help anytime! — ${botName}`;
    }

    // Balance
    if (msg.includes('balance') || msg.includes('how much') || msg.includes('money')) {
      const total = accounts.reduce((sum, acc) => sum + acc.balance, 0);
      const accsInfo = accounts.map(a => `• ${a.account_type === 'checking' ? 'Current' : 'Savings'} Account: ${fmt(a.balance)}`).join('\n');
      return `💰 **Your Account Balances**\n\n` +
        `**Total: ${fmt(total)}**\n\n` +
        `${accsInfo}\n\n` +
        `Want to add funds or make a transfer? I can guide you through it! — ${botName}`;
    }

    // Transactions history
    if (msg.includes('transactions') || msg.includes('history') || msg.includes('spending') || msg.includes('activity')) {
      const recent = transactions.slice(0, 5);
      if (recent.length === 0) return "No recent activity to show yet. Make a transfer or payment and it'll appear here!";
      const list = recent.map(t => {
        const prefix = t.transaction_type === 'deposit' ? '+' : '-';
        return `• ${prefix}${fmt(t.amount)} — ${t.recipient_name || t.description} (${fmtDate(t.timestamp).split(',')[0]})`;
      }).join('\n');
      return `📊 **Recent Activity (Last 5)**\n\n${list}\n\n` +
        `Want details on a specific transaction? Ask me about your "last transaction" for a full receipt! — ${botName}`;
    }

    // Account details
    if (msg.includes('account') && (msg.includes('number') || msg.includes('sort') || msg.includes('details'))) {
      const accsInfo = accounts.map(a =>
        `**${a.account_type === 'checking' ? 'Current' : 'Savings'} Account**\n` +
        `• Sort Code: ${a.sort_code || 'Not set'}\n` +
        `• Account No: ${a.account_number}`
      ).join('\n\n');
      return `🏦 **Your Account Details**\n\n${accsInfo}\n\n` +
        `You can update these in Settings → Personal Details. — ${botName}`;
    }

    // Greeting
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg === 'hey ellie' || msg === 'hi ellie') {
      return `Hello${user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋 I'm ${botName}, your personal banking assistant.\n\n` +
        `Here's what I can help with:\n` +
        `• View your last transaction receipt\n` +
        `• Check your balance\n` +
        `• Domestic transfer processing times\n` +
        `• **International transfer timings** (SWIFT & SEPA)\n` +
        `• Support hours & contact info\n` +
        `• Account details\n\n` +
        `Just ask me anything! — ${botName}`;
    }

    // Thank you
    if (msg.includes('thank') || msg.includes('thanks') || msg.includes('cheers')) {
      return `You're welcome! 😊 Happy to help anytime. Is there anything else I can assist you with? — ${botName}`;
    }

    // Default fallback
    return `I'm not sure I understand that one. Here's what I can help with:\n\n` +
      `• **"Last transaction"** — Full receipt with payee details\n` +
      `• **"Balance"** — Your current account balances\n` +
      `• **"Transfer delays"** — Processing times\n` +
      `• **"Support hours"** — How to contact HSBC\n` +
      `• **"Account details"** — Sort code & account number\n` +
      `• **"Recent activity"** — Last 5 transactions\n\n` +
      `Try one of these or tap a quick action below! — ${botName}`;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    Keyboard.dismiss();

    // Refresh data for accurate responses
    await loadData();

    // Realistic typing delay (7s as configured for production-feel responses)
    await new Promise(resolve => setTimeout(resolve, 7000));

    const response = getScriptedResponse(text.trim());
    // Detect and strip the hidden SEND_PDF marker used to attach an
    // inline "Send PDF confirmation" button below the AI reply.
    let cleanText = response;
    let action: 'send-pdf' | undefined;
    let txnId: string | undefined;
    const pdfMarker = response.match(/\n\[\[SEND_PDF:([^\]]+)\]\]/);
    if (pdfMarker) {
      cleanText = response.replace(pdfMarker[0], '');
      action = 'send-pdf';
      txnId = pdfMarker[1];
    }
    const aiMsg: Message = {
      role: 'assistant',
      content: cleanText,
      timestamp: new Date(),
      action,
      txnId,
    };
    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.header, { backgroundColor: cc.header }]}>
        <View style={styles.headerLeft}>
          <BackButton color={headerTextColor} />
          <View style={[styles.aiAvatar, { backgroundColor: cc.primary }]}>
            <Ionicons name="chatbubbles" size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: headerTextColor }]}>{botName}</Text>
            <Text style={[styles.headerSubtitle, { color: headerTextColor, opacity: 0.75 }]}>Your AI Banking Assistant</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome */}
          {messages.length === 0 && (
            <View style={styles.welcomeContainer}>
              <View style={[styles.welcomeAvatar, { backgroundColor: `${cc.primary}15` }]}>
                <Ionicons name="chatbubbles" size={32} color={cc.primary} />
              </View>
              <Text style={styles.welcomeTitle}>Hello! I'm {botName}</Text>
              <Text style={styles.welcomeText}>Your personal HSBC banking assistant. I can show you transaction receipts, check balances, and answer banking questions.</Text>

              <View style={styles.quickActionsContainer}>
                {QUICK_ACTIONS.map((action, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.quickActionCard}
                    onPress={() => sendMessage(action.message)}
                    testID={`quick-action-${i}`}
                  >
                    <Ionicons name={action.icon as any} size={22} color={cc.primary} />
                    <Text style={styles.quickActionLabel}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Messages */}
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const timeStr = msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            return (
              <View key={i} style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
                {!isUser && (
                  <View style={[styles.aiIcon, { backgroundColor: cc.primary }]}>
                    <Text style={styles.aiIconText}>E</Text>
                  </View>
                )}
                <View style={styles.bubbleColumn}>
                  <View style={[styles.messageContent, isUser ? [styles.userContent, { backgroundColor: cc.primary }] : styles.aiContent]}>
                    {isUser ? (
                      <Text style={[styles.messageText, styles.userText]}>{msg.content}</Text>
                    ) : (
                      <RichMessage content={msg.content} accentColor={cc.primary} />
                    )}
                  </View>
                  {/* Inline action button (e.g. Send PDF confirmation) */}
                  {!isUser && msg.action === 'send-pdf' && msg.txnId && (
                    <TouchableOpacity
                      style={[styles.actionChip, { borderColor: cc.primary }]}
                      onPress={async () => {
                        const target = transactions.find((t) => t.id === msg.txnId);
                        if (!target) return;
                        try {
                          await downloadReceipt(target as any);
                        } catch (e) {
                          console.error('receipt error', e);
                        }
                      }}
                      testID={`send-pdf-${i}`}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="document-attach-outline" size={16} color={cc.primary} />
                      <Text style={[styles.actionChipText, { color: cc.primary }]}>Send PDF confirmation</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.timestamp, isUser ? styles.timestampRight : styles.timestampLeft]}>{timeStr}</Text>
                </View>
              </View>
            );
          })}

          {isLoading && (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <View style={[styles.aiIcon, { backgroundColor: cc.primary }]}>
                <Text style={styles.aiIconText}>E</Text>
              </View>
              <View style={[styles.messageContent, styles.aiContent, styles.typingContainer]}>
                <TypingDots color={cc.primary} />
              </View>
            </View>
          )}

          {/* Quick actions after responses */}
          {messages.length > 0 && !isLoading && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineQuickActions}>
              {QUICK_ACTIONS.map((action, i) => (
                <TouchableOpacity key={i} style={styles.inlineQuickAction} onPress={() => sendMessage(action.message)}>
                  <Ionicons name={action.icon as any} size={16} color={cc.primary} />
                  <Text style={styles.inlineQuickActionText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder={`Ask ${botName} anything...`}
            placeholderTextColor={C.gray}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            testID="chat-input"
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: cc.primary }, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            testID="chat-send-btn"
          >
            <Ionicons name="send" size={20} color={C.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  aiAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  chatArea: { flex: 1 },
  chatContent: { paddingHorizontal: 14, paddingBottom: 16 },
  welcomeContainer: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  welcomeAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  welcomeTitle: { fontSize: 22, fontWeight: '700', color: C.darkGray, marginBottom: 8, textAlign: 'center' },
  welcomeText: { fontSize: 14, color: C.gray, textAlign: 'center', lineHeight: 21 },
  quickActionsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 24, gap: 12 },
  quickActionCard: {
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '45%',
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  quickActionLabel: { fontSize: 13, fontWeight: '600', color: C.darkGray, marginTop: 8, textAlign: 'center' },
  messageBubble: { flexDirection: 'row', marginTop: 14, maxWidth: '88%' },
  userBubble: { alignSelf: 'flex-end' },
  aiBubble: { alignSelf: 'flex-start' },
  bubbleColumn: { flexShrink: 1 },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  aiIconText: { color: C.white, fontWeight: '800', fontSize: 14 },
  messageContent: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  userContent: { borderBottomRightRadius: 6 },
  aiContent: { backgroundColor: C.bubbleBg, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: '#EEEEEE' },
  messageText: { fontSize: 14, lineHeight: 21 },
  userText: { color: C.userBubbleText, fontSize: 15, lineHeight: 22 },
  aiText: { color: C.darkGray },
  timestamp: { fontSize: 10, color: C.gray, marginTop: 4, paddingHorizontal: 4 },
  timestampLeft: { alignSelf: 'flex-start' },
  timestampRight: { alignSelf: 'flex-end' },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  actionChipText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  typingContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  typingText: { fontSize: 14, color: C.gray, marginLeft: 8 },
  inlineQuickActions: { paddingTop: 14, paddingBottom: 4 },
  inlineQuickAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#E5E5E5' },
  inlineQuickActionText: { fontSize: 13, color: C.darkGray, fontWeight: '600', marginLeft: 6 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: '#E8E8E8' },
  input: { flex: 1, backgroundColor: C.lightGray, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: C.black, maxHeight: 100, marginRight: 10 },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
});
