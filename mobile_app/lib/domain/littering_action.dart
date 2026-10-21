/// Optional littering-action block on POST /predict responses.
class LitteringActionResult {
  final bool eventDetected;
  final int eventCount;
  final double maxConfidence;

  const LitteringActionResult({
    required this.eventDetected,
    required this.eventCount,
    required this.maxConfidence,
  });

  factory LitteringActionResult.fromJson(Map<String, dynamic>? j) {
    if (j == null) {
      return const LitteringActionResult(
        eventDetected: false,
        eventCount: 0,
        maxConfidence: 0,
      );
    }
    final maxConf = j['max_confidence'];
    return LitteringActionResult(
      eventDetected: j['event_detected'] as bool? ?? false,
      eventCount: (j['event_count'] as num?)?.toInt() ?? 0,
      maxConfidence: maxConf == null ? 0 : (maxConf as num).toDouble(),
    );
  }
}
