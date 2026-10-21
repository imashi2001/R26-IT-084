import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/providers.dart';
import '../../theme/app_theme.dart';
import '../shared/illustrations.dart';
import '../shared/motion.dart';
import '../shared/widgets.dart';

class StaffLoginScreen extends ConsumerStatefulWidget {
  const StaffLoginScreen({super.key});

  @override
  ConsumerState<StaffLoginScreen> createState() => _StaffLoginScreenState();
}

class _StaffLoginScreenState extends ConsumerState<StaffLoginScreen> {
  final _emailCtl = TextEditingController();
  final _passCtl = TextEditingController();
  final _passFocus = FocusNode();
  bool _obscure = true;
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    _emailCtl.dispose();
    _passCtl.dispose();
    _passFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!(_form.currentState?.validate() ?? false)) return;
    await ref
        .read(authProvider.notifier)
        .login(_emailCtl.text.trim(), _passCtl.text);

    final state = ref.read(authProvider);
    if (state.isLoggedIn && mounted) {
      context.go('/staff/dashboard');
    }
  }

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    const headerHeight = 270.0;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // ── Illustrated header ──────────────────────────────────────────
            SizedBox(
              height: headerHeight,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      bottom: Radius.circular(36),
                    ),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        const AssetPhotoOr(
                          asset: 'assets/images/login_hero.jpg',
                          fallback: CityScene(height: headerHeight, showBins: false),
                        ),
                        Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.black.withValues(alpha: 0.1),
                                AppColors.background.withValues(alpha: 0.7),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Align(
                        alignment: Alignment.topLeft,
                        child: GlassIconButton(
                          icon: Icons.arrow_back_rounded,
                          onTap: _back,
                          tooltip: 'Back',
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 26,
                    child: Center(
                      child: PulseGlow(
                        color: AppColors.brand,
                        child: Container(
                          width: 76,
                          height: 76,
                          decoration: const BoxDecoration(
                            gradient: AppGradients.brand,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.shield_moon_rounded,
                            color: Colors.white,
                            size: 36,
                          ),
                        ),
                      ),
                    ).animate().scaleXY(
                          begin: 0.6,
                          end: 1,
                          duration: Motion.slow,
                          curve: Curves.easeOutBack,
                        ),
                  ),
                ],
              ),
            ),

            // ── Form ────────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 20, 22, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Welcome back',
                    textAlign: TextAlign.center,
                    style: AppText.h1,
                  ).entrance(index: 1),
                  const SizedBox(height: 6),
                  const Text(
                    'Sign in to the municipal staff portal',
                    textAlign: TextAlign.center,
                    style: AppText.body,
                  ).entrance(index: 2),
                  const SizedBox(height: 28),
                  StaffCard(
                    padding: const EdgeInsets.all(20),
                    radius: 26,
                    child: Form(
                      key: _form,
                      child: AutofillGroup(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const _FieldLabel('Email address'),
                            TextFormField(
                              controller: _emailCtl,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              autofillHints: const [AutofillHints.email],
                              onFieldSubmitted: (_) => _passFocus.requestFocus(),
                              style: const TextStyle(color: AppColors.textPrimary),
                              decoration: const InputDecoration(
                                hintText: 'you@council.gov.lk',
                                prefixIcon: Icon(Icons.alternate_email_rounded,
                                    size: 20),
                              ),
                              validator: (v) => (v ?? '').contains('@')
                                  ? null
                                  : 'Enter a valid email',
                            ),
                            const SizedBox(height: 16),
                            const _FieldLabel('Password'),
                            TextFormField(
                              controller: _passCtl,
                              focusNode: _passFocus,
                              obscureText: _obscure,
                              textInputAction: TextInputAction.done,
                              autofillHints: const [AutofillHints.password],
                              onFieldSubmitted: (_) => _submit(),
                              style: const TextStyle(color: AppColors.textPrimary),
                              decoration: InputDecoration(
                                hintText: '••••••••',
                                prefixIcon:
                                    const Icon(Icons.lock_rounded, size: 20),
                                suffixIcon: IconButton(
                                  icon: Icon(_obscure
                                      ? Icons.visibility_off_rounded
                                      : Icons.visibility_rounded),
                                  onPressed: () =>
                                      setState(() => _obscure = !_obscure),
                                ),
                              ),
                              validator: (v) => (v ?? '').length >= 6
                                  ? null
                                  : 'Password must be at least 6 characters',
                            ),
                            AnimatedSize(
                              duration: Motion.medium,
                              curve: Motion.curve,
                              child: auth.error == null
                                  ? const SizedBox(width: double.infinity)
                                  : Padding(
                                      padding: const EdgeInsets.only(top: 14),
                                      child: _ErrorBanner(message: auth.error!),
                                    ),
                            ),
                            const SizedBox(height: 22),
                            GlowPrimaryButton(
                              label: auth.loading ? 'Signing in…' : 'Sign in',
                              icon: Icons.login_rounded,
                              loading: auth.loading,
                              onPressed: _submit,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ).entrance(index: 3),
                  const SizedBox(height: 22),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text('Not municipal staff?', style: AppText.body),
                      TextButton(
                        onPressed: () => context.go('/public'),
                        child: const Text('Find a bin'),
                      ),
                    ],
                  ).entrance(index: 4),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.riskHigh.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.riskHigh.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_rounded, color: AppColors.riskHigh, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: AppColors.riskHigh, fontSize: 13),
            ),
          ),
        ],
      ),
    ).animate(key: ValueKey(message)).shakeX(hz: 4, amount: 4, duration: 400.ms);
  }
}
