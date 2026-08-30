import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/providers.dart';
import '../presentation/home_screen.dart';
import '../presentation/public/public_nearest_screen.dart';
import '../presentation/staff/staff_alerts_screen.dart';
import '../presentation/staff/staff_bin_detail_screen.dart';
import '../presentation/staff/staff_bins_screen.dart';
import '../presentation/staff/staff_dashboard_screen.dart';
import '../presentation/staff/staff_login_screen.dart';
import '../presentation/staff/staff_more_screen.dart';
import '../presentation/staff/staff_routes_screen.dart';
import '../presentation/staff/staff_shell.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    redirect: (context, state) {
      final loggedIn = auth.isLoggedIn;
      final path = state.fullPath ?? state.uri.path;
      final isStaffPath = path.startsWith('/staff');
      final isLoginPath = path == '/staff/login';

      if (isStaffPath && !isLoginPath && !loggedIn) {
        return '/staff/login';
      }
      if (isLoginPath && loggedIn) {
        return '/staff/dashboard';
      }
      // Legacy alias
      if (path == '/staff/bins' && state.uri.queryParameters.isEmpty) {
        return null;
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (_, __) => const HomeScreen(),
      ),
      GoRoute(
        path: '/public',
        builder: (_, __) => const PublicNearestScreen(),
      ),
      GoRoute(
        path: '/staff/login',
        builder: (_, __) => const StaffLoginScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return StaffShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/staff/dashboard',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: StaffDashboardScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/staff/bins',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: StaffBinsScreen(),
                ),
                routes: [
                  GoRoute(
                    path: ':id',
                    parentNavigatorKey: _rootNavigatorKey,
                    builder: (_, state) => StaffBinDetailScreen(
                      binId: int.parse(state.pathParameters['id']!),
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/staff/routes',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: StaffRoutesScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/staff/alerts',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: StaffAlertsScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/staff/more',
                pageBuilder: (context, state) => const NoTransitionPage(
                  child: StaffMoreScreen(),
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
