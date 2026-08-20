import 'package:flutter/material.dart';

// Brand palette — matches the web dashboard dark-slate / lime-green look
class AppColors {
  AppColors._();

  static const background = Color(0xFF0F172A);   // ink-900
  static const surface    = Color(0xFF1E293B);   // ink-800
  static const card       = Color(0xFF334155);   // ink-700
  static const border     = Color(0xFF475569);   // ink-600

  static const brand      = Color(0xFF22C55E);   // green-500
  static const brandDark  = Color(0xFF16A34A);   // green-600

  static const textPrimary   = Color(0xFFE2E8F0); // ink-200
  static const textSecondary = Color(0xFF94A3B8); // ink-400

  static const riskLow      = Color(0xFF22C55E);
  static const riskMedium   = Color(0xFFF59E0B);
  static const riskHigh     = Color(0xFFEF4444);
  static const riskCritical = Color(0xFFB91C1C);

  static const fillEmpty    = Color(0xFF22C55E);
  static const fillHalf     = Color(0xFFF59E0B);
  static const fillOverflow = Color(0xFFEF4444);
  static const fillUnknown  = Color(0xFF818CF8);
}

ThemeData buildAppTheme() {
  const colorScheme = ColorScheme.dark(
    primary:          AppColors.brand,
    onPrimary:        Color(0xFF0F172A),
    secondary:        AppColors.brandDark,
    onSecondary:      Color(0xFFE2E8F0),
    surface:          AppColors.surface,
    onSurface:        AppColors.textPrimary,
    surfaceContainerHighest: AppColors.card,
    error:            AppColors.riskHigh,
    onError:          Color(0xFFFFFFFF),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppColors.background,
    fontFamily: 'Roboto',

    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surface,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
        letterSpacing: -0.3,
      ),
    ),

    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border, width: 0.8),
      ),
      margin: EdgeInsets.zero,
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.brand,
        foregroundColor: AppColors.background,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),

    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.brand,
        side: const BorderSide(color: AppColors.brand),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.card,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.brand, width: 2),
      ),
      labelStyle: const TextStyle(color: AppColors.textSecondary),
      hintStyle: const TextStyle(color: AppColors.textSecondary),
    ),

    dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 0.8),

    listTileTheme: const ListTileThemeData(
      tileColor: Colors.transparent,
      iconColor: AppColors.textSecondary,
    ),
  );
}
