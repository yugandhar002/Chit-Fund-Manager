import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ViewStyle, 
  TextStyle 
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Theme } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  disabled, 
  loading,
  style,
  textStyle
}) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondary;
      case 'danger':
        return styles.danger;
      case 'success':
        return styles.success;
      case 'ghost':
        return styles.ghost;
      default:
        return styles.primary;
    }
  };

  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={disabled || loading}
      style={[styles.base, getButtonStyle(), style, disabled && styles.disabled]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? Colors.secondary : Colors.textPrimary} />
      ) : (
        <Text style={[
          styles.text, 
          variant === 'ghost' && styles.ghostText,
          textStyle
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: Colors.secondary, // Using secondary (Gold) as primary action color
  },
  secondary: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  danger: {
    backgroundColor: Colors.error,
  },
  success: {
    backgroundColor: Colors.success,
  },
  ghost: {
    backgroundColor: Colors.transparent,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  ghostText: {
    color: Colors.secondary,
  },
});
