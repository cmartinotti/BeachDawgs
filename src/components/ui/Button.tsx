import { Pressable, Text, StyleSheet, ActivityIndicator, type PressableProps } from 'react-native';
import { colors } from '@/styles/colors';
import { spacing, radius } from '@/styles/spacing';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({ label, variant = 'primary', size = 'md', loading = false, fullWidth = false, disabled, style, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}` as keyof typeof styles],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style as any,
      ]}
      disabled={isDisabled}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.primary} size="small" />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}` as keyof typeof styles], styles[`labelSize_${size}` as keyof typeof styles]]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },

  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.gray200 },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.red },

  size_sm: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  size_md: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  size_lg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },

  label: { fontWeight: '600' },
  label_primary: { color: colors.white },
  label_secondary: { color: colors.gray800 },
  label_ghost: { color: colors.primary },
  label_danger: { color: colors.white },

  labelSize_sm: { fontSize: 13 },
  labelSize_md: { fontSize: 15 },
  labelSize_lg: { fontSize: 17 },
});
