import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/providers.dart';
import '../theme/app_theme.dart';
import 'shared/illustrations.dart';
import 'shared/motion.dart';
import 'shared/widgets.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final heroUrl = ref.watch(dashboardSettingsProvider).valueOrNull?.heroImageUrl;
    final size = MediaQuery.sizeOf(context);
    final heroHeight = size.height * 0.5;

    return Scaffold(
      body: Stack(
        children: [
          // ── Hero artwork ─────────────────────────────────────────────────
          SizedBox(
            height: heroHeight,
            width: double.infinity,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (heroUrl != null && heroUrl.isNotEmpty)
                  AppNetworkImage(
                    url: heroUrl,
                    fallback: CityScene(height: heroHeight),
                  )
                else
                  AssetPhotoOr(
                    asset: 'assets/images/home_hero.jpg',
                    fallback: CityScene(height: heroHeight),
                  ),
                const DecoratedBox(
                  decoration: BoxDecoration(gradient: AppGradients.photoScrim),
                ),
              ],
            ),
          ),

          // ── Content ──────────────────────────────────────────────────────
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(22, 12, 22, 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _TopBar()
                            .animate()
                            .fadeIn(duration: Motion.slow)
                            .slideY(begin: -0.3, end: 0),
                        SizedBox(height: heroHeight * 0.72),
                        const Text('SMART WASTE MONITORING', style: AppText.overline)
                            .entrance(index: 1),
                        const SizedBox(height: 10),
                        const _Headline().entrance(index: 2),
                        const SizedBox(height: 12),
                        const Text(
                          'Find the nearest bin, see how full it is in real time and help keep your city clean.',
                          style: AppText.body,
                        ).entrance(index: 3),
                        const SizedBox(height: 18),
                        const _FeatureChips().entrance(index: 4),
                        const SizedBox(height: 26),
                        _RoleCard(
                          icon: Icons.near_me_rounded,
                          title: 'Find nearest bin',
                          subtitle: 'Live fill level & directions',
                          primary: true,
                          onTap: () => context.push('/public'),
                        ).entrance(index: 5),
                        const SizedBox(height: 12),
                        _RoleCard(
                          icon: Icons.badge_rounded,
                          title: 'Municipal staff',
                          subtitle: 'Dashboard, routes & alerts',
                          primary: false,
                          onTap: () => context.push('/staff/login'),
                        ).entrance(index: 6),
                        const SizedBox(height: 24),
                        const Center(
                          child: Text(
                            '© 2026 VisionWaste · R26-IT-084',
                            style: AppText.caption,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            gradient: AppGradients.brand,
            borderRadius: BorderRadius.circular(13),
            boxShadow: AppShadows.glow(AppColors.brand),
          ),
          child: const Icon(Icons.eco_rounded, color: Colors.white, size: 22),
        ),
        const SizedBox(width: 10),
        const Text(
          'VisionWaste',
          style: TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w700,
            color: Colors.white,
            letterSpacing: -0.3,
          ),
        ),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(100),
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: const Row(
            children: [
              LiveDot(),
              SizedBox(width: 6),
              Text(
                'Live',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Headline extends StatelessWidget {
  const _Headline();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Cleaner streets,', style: AppText.display),
        ShaderMask(
          shaderCallback: (r) => const LinearGradient(
            colors: [AppColors.brandGlow, AppColors.lime],
          ).createShader(r),
          child: const Text(
            'powered by AI.',
            style: TextStyle(
              fontSize: 34,
              fontWeight: FontWeight.w800,
              height: 1.15,
              letterSpacing: -1,
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }
}

class _FeatureChips extends StatelessWidget {
  const _FeatureChips();

  @override
  Widget build(BuildContext context) {
    const items = [
      (Icons.auto_awesome_rounded, 'AI fill detection', AppColors.brandGlow),
      (Icons.route_rounded, 'Smart routes', AppColors.accentBlue),
      (Icons.notifications_active_rounded, 'Live alerts', AppColors.riskMedium),
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (icon, label, color) in items)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(100),
              border: Border.all(color: color.withValues(alpha: 0.25)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 15, color: color),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _RoleCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool primary;
  final VoidCallback onTap;

  const _RoleCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.primary,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: primary
            ? AppColors.gradientCard(AppGradients.brand, radius: 24)
            : AppColors.glassCard(radius: 24),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: primary
                    ? Colors.white.withValues(alpha: 0.2)
                    : AppColors.brand.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                icon,
                color: primary ? Colors.white : AppColors.brandGlow,
                size: 26,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: primary ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12.5,
                      color: primary
                          ? Colors.white.withValues(alpha: 0.85)
                          : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: primary
                    ? Colors.white
                    : Colors.white.withValues(alpha: 0.06),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.arrow_forward_rounded,
                size: 18,
                color: primary ? AppColors.brandDark : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
