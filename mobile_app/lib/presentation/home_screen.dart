import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/app_theme.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF020617),
              AppColors.background,
              Color(0xFF14532D),
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Spacer(flex: 2),
                Center(
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      color: AppColors.brand.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.brand, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.brand.withValues(alpha: 0.25),
                          blurRadius: 24,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.delete_outline,
                        color: AppColors.brand, size: 48),
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'VisionWaste',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: AppColors.textPrimary,
                    letterSpacing: -1,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Find a bin. See fill level. Get there.',
                  textAlign: TextAlign.center,
                  style:
                      TextStyle(fontSize: 14, color: AppColors.textSecondary),
                ),
                const Spacer(),
                _RoleCard(
                  icon: Icons.location_on_outlined,
                  title: 'Find nearest bin',
                  subtitle: 'Public — GPS, fill level, and driving route',
                  filled: true,
                  onTap: () => context.push('/public'),
                ),
                const SizedBox(height: 12),
                _RoleCard(
                  icon: Icons.badge_outlined,
                  title: 'Municipal staff',
                  subtitle: 'Login — all bins, live status, capture detail',
                  filled: false,
                  onTap: () => context.push('/staff/login'),
                ),
                const Spacer(flex: 2),
                const Text(
                  '© 2026 VisionWaste  ·  R26-IT-084',
                  textAlign: TextAlign.center,
                  style:
                      TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool filled;
  final VoidCallback onTap;

  const _RoleCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.filled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled ? AppColors.brand : AppColors.surface.withValues(alpha: 0.85),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            children: [
              Icon(icon,
                  color: filled ? AppColors.background : AppColors.brand,
                  size: 28),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: filled
                            ? AppColors.background
                            : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: filled
                            ? AppColors.background.withValues(alpha: 0.75)
                            : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right,
                  color: filled
                      ? AppColors.background
                      : AppColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}
