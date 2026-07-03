/**
 * HeaderInfoButton — small (i) icon that appears in the top-right corner
 * of every main screen and opens the UserSwitcherModal on tap.
 *
 * Designed to drop into any header at the right edge:
 *   <View style={header}>
 *     <Title />
 *     <HeaderInfoButton tint="#FFFFFF" />
 *   </View>
 */
import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserSwitcherModal from './UserSwitcherModal';

interface Props {
  /** Foreground colour for the icon (so it stays visible on dark/light headers). */
  tint?: string;
  /** Optional override testID for testing. */
  testID?: string;
  /** Size in pt — defaults to 24. */
  size?: number;
}

export default function HeaderInfoButton({ tint = '#FFFFFF', testID = 'header-info-btn', size = 26 }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={s.btn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        testID={testID}
        accessibilityLabel="Switch user account"
        accessibilityRole="button"
      >
        <Ionicons name="information-circle-outline" size={size} color={tint} />
      </TouchableOpacity>
      <UserSwitcherModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  btn: {
    padding: 4,
    marginLeft: 8,
  },
});
