import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { chatApi } from '../src/services/api';

const COLORS = { primary: '#DB0011', white: '#FFFFFF', lightGray: '#F5F5F5', gray: '#767676', darkGray: '#333333', black: '#000000', success: '#00847F', background: '#F5F5F5' };

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_ACTIONS = [
  { label: 'Last Transaction', icon: 'receipt-outline', message: 'What was my last transaction? Give me full details including amount, date, and recipient.' },
  { label: 'Transfer Delays', icon: 'time-outline', message: 'What are the typical transfer processing times and any potential delays I should know about?' },
  { label: 'Support Hours', icon: 'call-outline', message: 'What are HSBC support hours and how can I contact customer service?' },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const scrollRef = useRef<ScrollView>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    Keyboard.dismiss();

    // 10-second response delay for realistic feel
    await new Promise(resolve => setTimeout(resolve, 10000));

    try {
      const res = await chatApi.send(text.trim(), sessionId);
      setSessionId(res.data.session_id);
      const aiMsg: Message = { role: 'assistant', content: res.data.response };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      const errMsg: Message = { role: 'assistant', content: 'Sorry, I\'m having trouble connecting. Please try again.' };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiAvatar}>
            <Ionicons name="chatbubbles" size={18} color={COLORS.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Ellie</Text>
            <Text style={styles.headerSubtitle}>Your AI Banking Assistant</Text>
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
          {/* Welcome message */}
          {messages.length === 0 && (
            <View style={styles.welcomeContainer}>
              <View style={styles.welcomeAvatar}>
                <Ionicons name="chatbubbles" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.welcomeTitle}>Hello! I'm Ellie</Text>
              <Text style={styles.welcomeText}>Your personal HSBC banking assistant. I can help with account info, transactions, transfers, and more. Try a quick action below or type your question.</Text>

              {/* Quick Actions */}
              <View style={styles.quickActionsContainer}>
                {QUICK_ACTIONS.map((action, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.quickActionCard}
                    onPress={() => sendMessage(action.message)}
                    testID={`quick-action-${i}`}
                  >
                    <Ionicons name={action.icon as any} size={22} color={COLORS.primary} />
                    <Text style={styles.quickActionLabel}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <View key={i} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {msg.role === 'assistant' && (
                <View style={styles.aiIcon}>
                  <Ionicons name="chatbubbles" size={14} color={COLORS.white} />
                </View>
              )}
              <View style={[styles.messageContent, msg.role === 'user' ? styles.userContent : styles.aiContent]}>
                <Text style={[styles.messageText, msg.role === 'user' ? styles.userText : styles.aiText]}>{msg.content}</Text>
              </View>
            </View>
          ))}

          {isLoading && (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <View style={styles.aiIcon}>
                <Ionicons name="chatbubbles" size={14} color={COLORS.white} />
              </View>
              <View style={[styles.messageContent, styles.aiContent, styles.typingContainer]}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.typingText}>Ellie is typing...</Text>
              </View>
            </View>
          )}

          {/* Quick actions after first response */}
          {messages.length > 0 && !isLoading && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineQuickActions}>
              {QUICK_ACTIONS.map((action, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.inlineQuickAction}
                  onPress={() => sendMessage(action.message)}
                >
                  <Ionicons name={action.icon as any} size={16} color={COLORS.primary} />
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
            placeholder="Ask me anything..."
            placeholderTextColor={COLORS.gray}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            testID="chat-input"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            testID="chat-send-btn"
          >
            <Ionicons name="send" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  aiAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.white },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  chatArea: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingBottom: 16 },
  welcomeContainer: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  welcomeAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  welcomeTitle: { fontSize: 20, fontWeight: '700', color: COLORS.darkGray, marginBottom: 8, textAlign: 'center' },
  welcomeText: { fontSize: 14, color: COLORS.gray, textAlign: 'center', lineHeight: 20 },
  quickActionsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 24, gap: 12 },
  quickActionCard: { backgroundColor: COLORS.white, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', width: '45%', minWidth: 140 },
  quickActionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.darkGray, marginTop: 8, textAlign: 'center' },
  messageBubble: { flexDirection: 'row', marginTop: 12, maxWidth: '85%' },
  userBubble: { alignSelf: 'flex-end' },
  aiBubble: { alignSelf: 'flex-start' },
  aiIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 2 },
  messageContent: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, maxWidth: '90%' },
  userContent: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  aiContent: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: COLORS.white },
  aiText: { color: COLORS.darkGray },
  typingContainer: { flexDirection: 'row', alignItems: 'center' },
  typingText: { fontSize: 14, color: COLORS.gray, marginLeft: 8 },
  inlineQuickActions: { paddingTop: 12, paddingBottom: 4 },
  inlineQuickAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: '#E0E0E0' },
  inlineQuickActionText: { fontSize: 13, color: COLORS.darkGray, fontWeight: '500', marginLeft: 6 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  input: { flex: 1, backgroundColor: COLORS.lightGray, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: COLORS.black, maxHeight: 100, marginRight: 10 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
});
