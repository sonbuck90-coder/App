import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cardsApi, Card } from '../../src/services/api';

export default function CardsScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await cardsApi.getAll();
      setCards(response.data);
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCardFreeze = async (card: Card) => {
    setProcessingCardId(card.id);
    try {
      if (card.is_frozen) {
        await cardsApi.unfreeze(card.id);
        Alert.alert('Success', 'Card unfrozen successfully');
      } else {
        await cardsApi.freeze(card.id);
        Alert.alert('Success', 'Card frozen successfully');
      }
      fetchCards();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update card');
    } finally {
      setProcessingCardId(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getCardGradient = (cardType: string, index: number) => {
    const gradients = [
      { bg: '#1A1A2E', accent: '#4A4A6A' },
      { bg: '#0066FF', accent: '#3D8BFF' },
      { bg: '#5856D6', accent: '#7E7CE5' },
      { bg: '#FF9500', accent: '#FFB340' },
    ];
    return gradients[index % gradients.length];
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066FF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Cards</Text>
          <Text style={styles.headerSubtitle}>Manage your cards</Text>
        </View>

        {/* Cards List */}
        {cards.map((card, index) => {
          const gradient = getCardGradient(card.card_type, index);
          return (
            <View key={card.id} style={styles.cardWrapper}>
              {/* Physical Card Design */}
              <View style={[styles.physicalCard, { backgroundColor: gradient.bg }]}>
                {card.is_frozen && (
                  <View style={styles.frozenOverlay}>
                    <Ionicons name="snow" size={48} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.frozenText}>FROZEN</Text>
                  </View>
                )}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{card.card_name}</Text>
                  <View style={styles.cardChip}>
                    <View style={styles.chipLine} />
                    <View style={styles.chipLine} />
                    <View style={styles.chipLine} />
                  </View>
                </View>
                <View style={styles.cardNumberContainer}>
                  <Text style={styles.cardNumber}>{card.card_number_masked}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.cardLabel}>VALID THRU</Text>
                    <Text style={styles.cardValue}>{card.expiry_date}</Text>
                  </View>
                  <View style={styles.cardType}>
                    {card.card_type === 'debit' ? (
                      <Text style={styles.cardTypeText}>VISA</Text>
                    ) : (
                      <Text style={styles.cardTypeText}>MASTERCARD</Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Card Actions */}
              <View style={styles.cardActions}>
                {card.card_type === 'credit' && card.credit_limit && (
                  <View style={styles.creditInfo}>
                    <View style={styles.creditRow}>
                      <Text style={styles.creditLabel}>Credit Limit</Text>
                      <Text style={styles.creditValue}>{formatCurrency(card.credit_limit)}</Text>
                    </View>
                    <View style={styles.creditRow}>
                      <Text style={styles.creditLabel}>Available</Text>
                      <Text style={[styles.creditValue, styles.availableCredit]}>
                        {formatCurrency(card.available_credit || 0)}
                      </Text>
                    </View>
                    <View style={styles.creditBar}>
                      <View
                        style={[
                          styles.creditUsed,
                          {
                            width: `${((card.credit_limit - (card.available_credit || 0)) / card.credit_limit) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      card.is_frozen && styles.actionButtonActive,
                    ]}
                    onPress={() => toggleCardFreeze(card)}
                    disabled={processingCardId === card.id}
                  >
                    {processingCardId === card.id ? (
                      <ActivityIndicator size="small" color="#0066FF" />
                    ) : (
                      <>
                        <Ionicons
                          name={card.is_frozen ? 'snow' : 'snow-outline'}
                          size={20}
                          color={card.is_frozen ? '#0066FF' : '#666666'}
                        />
                        <Text
                          style={[
                            styles.actionButtonText,
                            card.is_frozen && styles.actionButtonTextActive,
                          ]}
                        >
                          {card.is_frozen ? 'Unfreeze' : 'Freeze'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="settings-outline" size={20} color="#666666" />
                    <Text style={styles.actionButtonText}>Settings</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="document-text-outline" size={20} color="#666666" />
                    <Text style={styles.actionButtonText}>Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {/* Add New Card Button */}
        <TouchableOpacity style={styles.addCardButton}>
          <Ionicons name="add-circle-outline" size={24} color="#0066FF" />
          <Text style={styles.addCardText}>Add New Card</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666666',
  },
  cardWrapper: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  physicalCard: {
    borderRadius: 20,
    padding: 24,
    height: 200,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  frozenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  frozenText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardChip: {
    width: 40,
    height: 30,
    backgroundColor: '#C4A86C',
    borderRadius: 4,
    padding: 4,
    justifyContent: 'space-around',
  },
  chipLine: {
    height: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 1,
  },
  cardNumberContainer: {
    alignItems: 'center',
  },
  cardNumber: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardType: {},
  cardTypeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  cardActions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: -20,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  creditInfo: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  creditLabel: {
    fontSize: 14,
    color: '#666666',
  },
  creditValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  availableCredit: {
    color: '#00C853',
  },
  creditBar: {
    height: 6,
    backgroundColor: '#E8F0FE',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  creditUsed: {
    height: '100%',
    backgroundColor: '#0066FF',
    borderRadius: 3,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    minWidth: 80,
  },
  actionButtonActive: {
    backgroundColor: '#E8F0FE',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
    fontWeight: '500',
  },
  actionButtonTextActive: {
    color: '#0066FF',
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E8F0FE',
    borderStyle: 'dashed',
  },
  addCardText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066FF',
    marginLeft: 8,
  },
});
