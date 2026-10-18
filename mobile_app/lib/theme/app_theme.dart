import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

/// VisionWaste design system — deep ink surfaces with emerald "eco-tech"
/// accents. Every screen reads colours from here, so tweaking a token
/// restyles the whole app.
class AppColors {
  AppColors._();

  // ── Surfaces ──────────────────────────────────────────────────────────────
  static const background = Color(0xFF0A0F14);
  static const surface = Color(0xFF111A21);
  static const surfaceElevated = Color(0xFF17232C);
  static const card = Color(0xFF1D2B35);
  static const border = Color(0xFF263845);

  // ── Brand ─────────────────────────────────────────────────────────────────
  static const brand = Color(0xFF10B981);
  static const brandGlow = Color(0xFF34D399);
  static const brandDark = Color(0xFF047857);
  static const lime = Color(0xFFA3E635);

  // ── Text ──────────────────────────────────────────────────────────────────
  static const textPrimary = Color(0xFFF1F5F9);
  static const textSecondary = Color(0xFFA9B6C3);
  static const textMuted = Color(0xFF6E7F8E);

  // ── Status ────────────────────────────────────────────────────────────────
  static const riskLow = Color(0xFF22C55E);
  static const riskMedium = Color(0xFFF59E0B);
  static const riskHigh = Color(0xFFF43F5E);
  static const riskCritical = Color(0xFFE11D48);

  static const fillEmpty = Color(0xFF22C55E);
  static const fillHalf = Color(0xFFF59E0B);
  static const fillOverflow = Color(0xFFF43F5E);
  static const fillUnknown = Color(0xFF818CF8);

  // ── Accents ───────────────────────────────────────────────────────────────
  static const accentPurple = Color(0xFF8B5CF6);
  static const accentBlue = Color(0xFF38BDF8);
  static const accentTeal = Color(0xFF2DD4BF);
  static const accentPink = Color(0xFFEC4899);

  /// Frosted card used across the app.
  static BoxDecoration glassCard({Color? tint, double radius = 20}) {
    return BoxDecoration(
      borderRadius: BorderRadius.circular(radius),
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Color.alphaBlend(
            (tint ?? Colors.transparent),
            AppColors.surfaceElevated,
          ),
          AppColors.surface,
        ],
      ),
      border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      boxShadow: AppShadows.soft,
    );
  }

  /// Card filled with a vivid gradient (KPI tiles, hero cards).
  static BoxDecoration gradientCard(Gradient gradient, {double radius = 22}) {
    return BoxDecoration(
      borderRadius: BorderRadius.circular(radius),
      gradient: gradient,
      boxShadow: [
        BoxShadow(
          color: gradient.colors.last.withValues(alpha: 0.35),
          blurRadius: 24,
          offset: const Offset(0, 10),
        ),
      ],
    );
  }

  static BoxDecoration glowButton() => BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: AppGradients.brand,
        boxShadow: [
          BoxShadow(
            color: brand.withValues(alpha: 0.45),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      );
}

class AppGradients {
  AppGradients._();

  static const brand = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF34D399), Color(0xFF059669)],
  );

  static const forest = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF065F46), Color(0xFF0B3B33), Color(0xFF0A0F14)],
  );

  static const sunrise = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFBBF24), Color(0xFFF97316)],
  );

  static const danger = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFB7185), Color(0xFFE11D48)],
  );

  static const fresh = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF4ADE80), Color(0xFF16A34A)],
  );

  static const violet = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFA78BFA), Color(0xFF6366F1)],
  );

  static const ocean = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF38BDF8), Color(0xFF2563EB)],
  );

  /// Dark scrim placed over photos so text stays readable.
  static const photoScrim = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x00000000), Color(0x660A0F14), Color(0xF20A0F14)],
    stops: [0.0, 0.55, 1.0],
  );

  /// Gradient matching a fill tier (empty / half / overflow).
  static LinearGradient forFill(String? level) {
    switch ((level ?? '').toLowerCase()) {
      case 'empty':
        return fresh;
      case 'half':
        return sunrise;
      case 'overflow':
        return danger;
      default:
        return violet;
    }
  }
}

class AppShadows {
  AppShadows._();

  static final soft = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.28),
      blurRadius: 18,
      offset: const Offset(0, 8),
    ),
  ];

  static List<BoxShadow> glow(Color color, {double strength = 0.4}) => [
        BoxShadow(
          color: color.withValues(alpha: strength),
          blurRadius: 22,
          offset: const Offset(0, 8),
        ),
      ];
}

/// Typography helpers (Poppins is bundled in assets/fonts).
class AppText {
  AppText._();

  static const display = TextStyle(
    fontSize: 34,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    height: 1.1,
    letterSpacing: -1.0,
  );

  static const h1 = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    height: 1.2,
    letterSpacing: -0.5,
  );

  static const h2 = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    letterSpacing: -0.2,
  );

  static const title = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static const body = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
    height: 1.45,
  );

  static const caption = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    color: AppColors.textMuted,
  );

  static const overline = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w600,
    color: AppColors.textMuted,
    letterSpacing: 1.2,
  );

  static const number = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    height: 1,
    letterSpacing: -0.8,
  );
}

ThemeData buildAppTheme() {
  const colorScheme = ColorScheme.dark(
    primary: AppColors.brand,
    onPrimary: Colors.white,
    secondary: AppColors.accentTeal,
    onSecondary: AppColors.background,
    surface: AppColors.surface,
    onSurface: AppColors.textPrimary,
    surfaceContainerHighest: AppColors.card,
    error: AppColors.riskHigh,
    onError: Colors.white,
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    fontFamily: 'Poppins',
  );

  return base.copyWith(
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppColors.background,
    splashFactory: InkSparkle.splashFactory,
    textTheme: base.textTheme.apply(
      bodyColor: AppColors.textPrimary,
      displayColor: AppColors.textPrimary,
      fontFamily: 'Poppins',
    ),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.background,
      foregroundColor: AppColors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: AppText.h2,
    ),
    iconTheme: const IconThemeData(color: AppColors.textPrimary),
    dividerTheme: DividerThemeData(
      color: Colors.white.withValues(alpha: 0.06),
      thickness: 1,
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.06)),
      ),
      margin: EdgeInsets.zero,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.brand,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
        textStyle: const TextStyle(
          fontFamily: 'Poppins',
          fontWeight: FontWeight.w600,
          fontSize: 15,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textPrimary,
        side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
        backgroundColor: Colors.white.withValues(alpha: 0.03),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 15),
        textStyle: const TextStyle(
          fontFamily: 'Poppins',
          fontWeight: FontWeight.w600,
          fontSize: 14,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AppColors.brandGlow,
        textStyle: const TextStyle(
          fontFamily: 'Poppins',
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surfaceElevated,
      labelStyle: const TextStyle(color: AppColors.textSecondary),
      hintStyle: const TextStyle(color: AppColors.textMuted),
      prefixIconColor: AppColors.textSecondary,
      suffixIconColor: AppColors.textSecondary,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.06)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.06)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.brand, width: 1.6),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.riskHigh),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.card,
      contentTextStyle: const TextStyle(
        fontFamily: 'Poppins',
        color: AppColors.textPrimary,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surface,
      showDragHandle: true,
      dragHandleColor: AppColors.border,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      titleTextStyle: AppText.h2,
      contentTextStyle: AppText.body,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: AppColors.brand,
    ),
    tabBarTheme: const TabBarThemeData(
      dividerColor: Colors.transparent,
      labelColor: Colors.white,
      unselectedLabelColor: AppColors.textSecondary,
      labelStyle: TextStyle(fontFamily: 'Poppins', fontWeight: FontWeight.w600),
    ),
  );
}
