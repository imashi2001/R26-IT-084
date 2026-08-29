import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/providers.dart';
import '../presentation/home_screen.dart';
import '../presentation/public/public_nearest_screen.dart';
import '../presentation/staff/staff_login_screen.dart';
import '../presentation/staff/staff_bins_screen.dart';
import '../presentation/staff/staff_bin_detail_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final loggedIn = auth.isLoggedIn;
      final isStaffPath = state.fullPath?.startsWith('/staff') ?? false;
      final isLoginPath = state.fullPath == '/staff/login';

      if (isStaffPath && !isLoginPath && !loggedIn) {
        return '/staff/login';
      }
      if (isLoginPath && loggedIn) {
        return '/staff/bins';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/',         builder: (_, __) => const HomeScreen()),
      GoRoute(path: '/public',   builder: (_, __) => const PublicNearestScreen()),
      GoRoute(path: '/staff/login', builder: (_, __) => const StaffLoginScreen()),
      GoRoute(path: '/staff/bins',  builder: (_, __) => const StaffBinsScreen()),
      GoRoute(
        path: '/staff/bins/:id',
        builder: (_, state) => StaffBinDetailScreen(
          binId: int.parse(state.pathParameters['id']!),
        ),
      ),
    ],
  );
});
