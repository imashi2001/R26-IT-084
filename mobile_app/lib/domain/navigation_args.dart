/// Arguments for [InAppNavigationScreen].
class InAppNavigationArgs {
  final String title;
  final bool collectionRoute;
  final List<NavWaypoint> waypoints;
  final int initialStopIndex;
  final List<List<double>>? previewPath;
  final bool darkMap;

  const InAppNavigationArgs({
    required this.title,
    required this.waypoints,
    this.collectionRoute = false,
    this.initialStopIndex = 0,
    this.previewPath,
    this.darkMap = true,
  });

  NavWaypoint get activeWaypoint =>
      waypoints[initialStopIndex.clamp(0, waypoints.length - 1)];
}

class NavWaypoint {
  final double latitude;
  final double longitude;
  final String label;
  final String? subtitle;
  final int? order;

  const NavWaypoint({
    required this.latitude,
    required this.longitude,
    required this.label,
    this.subtitle,
    this.order,
  });
}
