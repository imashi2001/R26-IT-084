import 'package:flutter/material.dart';

/// VisionWaste staff app palette — matches premium dark mockup (#121826 base).
class AppColors {
  AppColors._();

  static const background = Color(0xFF121826);
  static const surface = Color(0xFF1A2332);
  static const surfaceElevated = Color(0xFF222D3F);
  static const card = Color(0xFF2A3548);
  static const border = Color(0xFF3D4F6A);

  static const brand = Color(0xFF4CAF50);
  static const brandGlow = Color(0xFF66BB6A);
  static const brandDark = Color(0xFF388E3C);

  static const textPrimary = Color(0xFFF1F5F9);
  static const textSecondary = Color(0xFF94A3B8);
  static const textMuted = Color(0xFF64748B);

  static const riskLow = Color(0xFF4CAF50);
  static const riskMedium = Color(0xFFF59E0B);
  static const riskHigh = Color(0xFFEF4444);
  static const riskCritical = Color(0xFFB91C1C);

  static const fillEmpty = Color(0xFF4CAF50);
  static const fillHalf = Color(0xFFF59E0B);
  static const fillOverflow = Color(0xFFEF4444);
  static const fillUnknown = Color(0xFF818CF8);

  static const accentPurple = Color(0xFF8B5CF6);
  static const accentBlue = Color(0xFF38BDF8);

  static BoxDecoration glassCard({Color? tint, double radius = 16}) {
    return BoxDecoration(
      borderRadius: BorderRadius.circular(radius),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          (tint ?? AppColors.surface).withValues(alpha: 0.95),
          AppColors.surfaceElevated.withValues(alpha: 0.88),
        ],
      ),
      border: Border.all(color: AppColors.border.withValues(alpha: 0.45)),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.25),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  static BoxDecoration glowButton() => BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: const LinearGradient(
          colors: [brandGlow, brand],
        ),
        boxShadow: [
          BoxShadow(
            color: brand.withValues(alpha: 0.45),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      );
}

ThemeData buildAppTheme() {
  const colorScheme = ColorScheme.dark(
    primary: AppColors.brand,
    onPrimary: Colors.white,
    secondary: AppColors.brandDark,
    onSecondary: AppColors.textPrimary,
    surface: AppColors.surface,
    onSurface: AppColors.textPrimary,
    surfaceContainerHighest: AppColors.card,
    error: AppColors.riskHigh,
    onError: Colors.white,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppColors.background,
    fontFamily: 'Roboto',
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.surface,
      indicatorColor: AppColors.brand.withValues(alpha: 0.2),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 11,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? AppColors.brand : AppColors.textMuted,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: selected ? AppColors.brand : AppColors.textMuted,
          size: 22,
        );
      }),
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: AppColors.border.withValues(alpha: 0.5)),
      ),
      margin: EdgeInsets.zero,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        side: BorderSide(color: AppColors.border.withValues(alpha: 0.8)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surfaceElevated,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: AppColors.border.withValues(alpha: 0.6)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.brand, width: 2),
      ),
    ),
  );
}
