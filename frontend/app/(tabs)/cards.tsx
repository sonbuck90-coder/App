import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { cardsApi, Card } from '../../src/services/api';
import { useCustomization } from '../../src/context/CustomizationContext';

const { width } = Dimensions.get('window');

// Static colors (non-primary)
const COLORS = {
  secondary: '#333333',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  gray: '#767676',
  darkGray: '#333333',
  black: '#000000',
  success: '#00847F',
  background: '#F5F5F5',
};

export default function CardsScreen() {
  const { colors: customColors } = useCustomization();
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

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
        Alert.alert('Card Activated', 'Your card is now active');
      } else {
        await cardsApi.freeze(card.id);
        Alert.alert('Card Frozen', 'Your card has been temporarily frozen');
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
      currency: 'GBP',
    }).format(value);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={customColors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: customColors.primary }]}>
        <Text style={styles.headerTitle}>Cards</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Card Carousel */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / (width - 48));
            setActiveCardIndex(index);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={styles.cardCarousel}
        >
          {cards.map((card, index) => (
            <View key={card.id} style={styles.cardWrapper}>
              <View style={[styles.physicalCard, card.is_frozen && styles.frozenCard]}>
                {card.is_frozen && (
                  <View style={styles.frozenBadge}>
                    <Ionicons name="snow" size={14} color={COLORS.white} />
                    <Text style={styles.frozenBadgeText}>FROZEN</Text>
                  </View>
                )}
                <View style={styles.cardTop}>
                  <View style={styles.cardLogoContainer}>
                    <View style={styles.cardHexagonRow}>
                      <View style={[styles.cardHexagon, styles.cardHexagonWhite]} />
                      <View style={[styles.cardHexagon, styles.cardHexagonRed]} />
                    </View>
                    <View style={styles.cardHexagonRow}>
                      <View style={[styles.cardHexagon, styles.cardHexagonRed]} />
                      <View style={[styles.cardHexagon, styles.cardHexagonWhite]} />
                    </View>
                  </View>
                  <Text style={styles.cardBrandText}>HSBC</Text>
                </View>
                <View style={styles.cardChip}>
                  <View style={styles.chipInner} />
                </View>
                <Text style={styles.cardNumberText}>{card.card_number_masked}</Text>
                <View style={styles.cardBottom}>
                  <View>
                    <Text style={styles.cardLabel}>VALID THRU</Text>
                    <Text style={styles.cardValue}>{card.expiry_date}</Text>
                  </View>
                  <View>
                    <Text style={styles.cardLabel}>CARD TYPE</Text>
                    <Text style={styles.cardValue}>{card.card_type.toUpperCase()}</Text>
                  </View>
                  <View style={styles.cardNetwork}>
                    {card.card_type === 'debit' ? (
                      <Text style={styles.networkText}>VISA</Text>
                    ) : (
                      <View style={styles.mastercardLogo}>
                        <View style={[styles.mcCircle, styles.mcCircleRed]} />
                        <View style={[styles.mcCircle, styles.mcCircleOrange]} />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Card Indicators */}
        <View style={styles.cardIndicators}>
          {cards.map((_, index) => (
            <View
              key={index}
              style={[styles.indicator, activeCardIndex === index && [styles.indicatorActive, { backgroundColor: customColors.primary }]]}
            />
          ))}
        </View>

        {/* Card Info */}
        {cards[activeCardIndex] && (
          <View style={styles.cardInfoSection}>
            <Text style={styles.cardInfoTitle}>{cards[activeCardIndex].card_name}</Text>
            
            {cards[activeCardIndex].card_type === 'credit' && cards[activeCardIndex].credit_limit && (
              <View style={styles.creditInfoCard}>
                <View style={styles.creditRow}>
                  <Text style={styles.creditLabel}>Credit Limit</Text>
                  <Text style={styles.creditValue}>{formatCurrency(cards[activeCardIndex].credit_limit || 0)}</Text>
                </View>
                <View style={styles.creditRow}>
                  <Text style={styles.creditLabel}>Available Credit</Text>
                  <Text style={[styles.creditValue, styles.availableCredit]}>
                    {formatCurrency(cards[activeCardIndex].available_credit || 0)}
                  </Text>
                </View>
                <View style={styles.creditProgressBar}>
                  <View
                    style={[
                      styles.creditProgressFill,
                      {
                        width: `${((cards[activeCardIndex].credit_limit! - (cards[activeCardIndex].available_credit || 0)) / cards[activeCardIndex].credit_limit!) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.creditUsed}>
                  {formatCurrency(cards[activeCardIndex].credit_limit! - (cards[activeCardIndex].available_credit || 0))} used
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Card Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.actionsTitle}>Card Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => cards[activeCardIndex] && toggleCardFreeze(cards[activeCardIndex])}
              disabled={processingCardId === cards[activeCardIndex]?.id}
            >
              <View style={[styles.actionIcon, cards[activeCardIndex]?.is_frozen && styles.actionIconActive]}>
                {processingCardId === cards[activeCardIndex]?.id ? (
                  <ActivityIndicator size="small" color={customColors.primary} />
                ) : (
                  <Ionicons
                    name={cards[activeCardIndex]?.is_frozen ? 'snow' : 'snow-outline'}
                    size={24}
                    color={cards[activeCardIndex]?.is_frozen ? customColors.primary : COLORS.darkGray}
                  />
                )}
              </View>
              <Text style={styles.actionLabel}>
                {cards[activeCardIndex]?.is_frozen ? 'Unfreeze' : 'Freeze Card'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem}>
              <View style={styles.actionIcon}>
                <Ionicons name="eye-outline" size={24} color={COLORS.darkGray} />
              </View>
              <Text style={styles.actionLabel}>View PIN</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem}>
              <View style={styles.actionIcon}>
                <Ionicons name="settings-outline" size={24} color={COLORS.darkGray} />
              </View>
              <Text style={styles.actionLabel}>Card Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem}>
              <View style={styles.actionIcon}>
                <Ionicons name="location-outline" size={24} color={COLORS.darkGray} />
              </View>
              <Text style={styles.actionLabel}>ATM Locator</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem}>
              <View style={styles.actionIcon}>
                <Ionicons name="notifications-outline" size={24} color={COLORS.darkGray} />
              </View>
              <Text style={styles.actionLabel}>Alerts</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem}>
              <View style={styles.actionIcon}>
                <Ionicons name="help-circle-outline" size={24} color={COLORS.darkGray} />
              </View>
              <Text style={styles.actionLabel}>Report Lost</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    backgroundColor: '#DB0011',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  cardCarousel: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  cardWrapper: {
    width: width - 48,
    paddingRight: 16,
  },
  physicalCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    height: 200,
    justifyContent: 'space-between',
  },
  frozenCard: {
    opacity: 0.7,
  },
  frozenBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  frozenBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLogoContainer: {},
  cardHexagonRow: {
    flexDirection: 'row',
  },
  cardHexagon: {
    width: 10,
    height: 10,
    margin: 0.5,
  },
  cardHexagonWhite: {
    backgroundColor: COLORS.white,
  },
  cardHexagonRed: {
    backgroundColor: '#DB0011',
  },
  cardBrandText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  cardChip: {
    width: 40,
    height: 30,
    backgroundColor: '#C4A86C',
    borderRadius: 4,
    padding: 4,
    justifyContent: 'center',
  },
  chipInner: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 2,
  },
  cardNumberText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 3,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    marginBottom: 2,
  },
  cardValue: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  cardNetwork: {},
  networkText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  mastercardLogo: {
    flexDirection: 'row',
  },
  mcCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  mcCircleRed: {
    backgroundColor: '#EB001B',
  },
  mcCircleOrange: {
    backgroundColor: '#F79E1B',
    marginLeft: -10,
    opacity: 0.8,
  },
  cardIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
    marginHorizontal: 4,
  },
  indicatorActive: {
    backgroundColor: '#DB0011',
    width: 24,
  },
  cardInfoSection: {
    marginHorizontal: 24,
    marginTop: 24,
  },
  cardInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginBottom: 16,
  },
  creditInfoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  creditLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  creditValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  availableCredit: {
    color: COLORS.success,
  },
  creditProgressBar: {
    height: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 8,
  },
  creditProgressFill: {
    height: '100%',
    backgroundColor: '#DB0011',
    borderRadius: 4,
  },
  creditUsed: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
  },
  actionsSection: {
    marginHorizontal: 24,
    marginTop: 24,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 8,
  },
  actionItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionIconActive: {
    backgroundColor: '#FFF0F0',
  },
  actionLabel: {
    fontSize: 12,
    color: COLORS.darkGray,
    fontWeight: '500',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
  },
});
