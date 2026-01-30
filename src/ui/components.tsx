import { Pressable, Text, View, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme, fonts, typography } from './theme';
import { ReactNode } from 'react';

export function Badge({ 
  children, 
  color, 
  textColor = '#ffffff' 
}: { 
  children: ReactNode; 
  color: string; 
  textColor?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{children}</Text>
    </View>
  );
}

export function PrimaryButton({ 
  onPress, 
  children, 
  disabled = false,
  icon,
  style
}: { 
  onPress: () => void; 
  children: ReactNode; 
  disabled?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const buttonStyle = style as any;
  const customBg = buttonStyle?.backgroundColor;
  
  // Determine background color
  let backgroundColor = customBg || theme.colors.yellow;
  if (disabled) {
    backgroundColor = '#D1D5DB'; // Muted gray
  }
  
  // Determine text color
  let textColor = theme.colors.black;
  if (!disabled && customBg) {
    textColor = theme.colors.white;
  }
  
  return (
    <Pressable 
      onPress={onPress} 
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton, 
        { 
          backgroundColor,
          borderColor: theme.colors.black,
          borderRadius: 12,
          transform: pressed && !disabled ? [{ translateX: 2 }, { translateY: 2 }] : [],
          borderTopWidth: pressed && !disabled ? 2 : disabled ? 2 : 3,
          borderLeftWidth: pressed && !disabled ? 2 : disabled ? 2 : 3,
          borderBottomWidth: pressed && !disabled ? 4 : disabled ? 4 : 8,
          borderRightWidth: pressed && !disabled ? 4 : disabled ? 4 : 8,
        },
        style
      ]}
    >
      <View style={styles.buttonContent}>
        {icon}
        <Text style={[styles.primaryButtonText, { color: textColor }]}>{children}</Text>
      </View>
    </Pressable>
  );
}

export function IconButton({ 
  onPress, 
  children, 
  color,
  style
}: { 
  onPress: () => void; 
  children: ReactNode; 
  color: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { 
          backgroundColor: color,
          borderColor: theme.colors.black,
          borderRadius: 12,
          transform: pressed ? [{ translateX: 2 }, { translateY: 2 }] : [],
          borderTopWidth: pressed ? 2 : 3,
          borderLeftWidth: pressed ? 2 : 3,
          borderBottomWidth: pressed ? 4 : 8,
          borderRightWidth: pressed ? 4 : 8,
        },
        style
      ]}
    >
      {children}
    </Pressable>
  );
}

export function NavButton({ 
  onPress, 
  icon, 
  label, 
  color 
}: { 
  onPress: () => void; 
  icon: ReactNode; 
  label: string; 
  color: string;
}) {
  const theme = useTheme();
  return (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.navButton,
        { 
          backgroundColor: color,
          borderColor: theme.colors.black,
          borderRadius: 12,
          transform: pressed ? [{ translateX: 2 }, { translateY: 2 }] : [],
          borderTopWidth: pressed ? 2 : 3,
          borderLeftWidth: pressed ? 2 : 3,
          borderBottomWidth: pressed ? 4 : 8,
          borderRightWidth: pressed ? 4 : 8,
        }
      ]}
    >
      <View style={styles.navButtonContent}>
        {icon}
        <Text style={[styles.navButtonText, { color: theme.colors.black }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function SegmentedControl({ 
  options, 
  selected, 
  onSelect 
}: { 
  options: string[]; 
  selected: string; 
  onSelect: (option: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmentedControl, { borderColor: theme.colors.black, borderRadius: 12, backgroundColor: theme.colors.white }]}>
      {options.map((option, index) => (
        <Pressable
          key={option}
          onPress={() => onSelect(option)}
          style={({ pressed }) => [
            styles.segment,
            {
              backgroundColor: selected === option ? theme.colors.black : 'transparent',
              borderRadius: selected === option ? 8 : 0,
              transform: pressed ? [{ scale: 0.97 }] : [],
            }
          ]}
        >
          <Text style={[
            styles.segmentText, 
            { color: selected === option ? theme.colors.white : theme.colors.muted }
          ]}>
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SparkCard({ 
  type, 
  content, 
  timestamp, 
  status,
  onPress
}: { 
  type: 'PROJECT' | 'FEATURE'; 
  content: string; 
  timestamp: string; 
  status: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  
  const statusColor = status === 'NEW' ? theme.colors.pink : theme.colors.cyan;
  
  return (
    <Pressable 
      onPress={onPress}
      style={({ pressed }) => [
        styles.sparkCard,
        { 
          borderColor: theme.colors.black,
          backgroundColor: theme.colors.white,
          borderRadius: 12,
          transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
          borderTopWidth: pressed ? 2 : 3,
          borderLeftWidth: pressed ? 2 : 3,
          borderBottomWidth: pressed ? 5 : 8,
          borderRightWidth: pressed ? 5 : 8,
        }
      ]}
    >
      <View style={styles.sparkCardHeader}>
        <Badge color={theme.colors.white} textColor={theme.colors.black}>
          {type}
        </Badge>
        <Badge color={statusColor}>
          {status}
        </Badge>
      </View>
      <Text style={[styles.sparkCardContent, { color: theme.colors.black }]} numberOfLines={2}>
        {content}
      </Text>
      <Text style={[styles.sparkCardTimestamp, { color: theme.colors.textSecondary }]}>
        {timestamp}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
  },
  iconButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButton: {
    flex: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  navButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderBottomWidth: 8,
    borderRightWidth: 8,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sparkCard: {
    padding: 16,
    marginBottom: 12,
  },
  sparkCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sparkCardContent: {
    fontFamily: fonts.medium,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    lineHeight: 22,
  },
  sparkCardTimestamp: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
});
