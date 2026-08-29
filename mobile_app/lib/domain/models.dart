// Domain models (no Flutter/UI imports).

class Bin {
  final int id;
  final String name;
  final String? location;
  final String? address;
  final double latitude;
  final double longitude;
  final String? latestFillLevel;
  final double? latestFillPercentage;
  final String? latestRiskLevel;
  final String? latestCapturedAt;
  final String? latestImageUrl;
  final String? latestSourceType;

  const Bin({
    required this.id,
    required this.name,
    this.location,
    this.address,
    required this.latitude,
    required this.longitude,
    this.latestFillLevel,
    this.latestFillPercentage,
    this.latestRiskLevel,
    this.latestCapturedAt,
    this.latestImageUrl,
    this.latestSourceType,
  });

  factory Bin.fromJson(Map<String, dynamic> j) => Bin(
        id: (j['id'] as num).toInt(),
        name: j['name'] as String? ?? 'Bin ${j['id']}',
        location: j['location'] as String?,
        address: j['address'] as String?,
        latitude: _d(j['latitude']),
        longitude: _d(j['longitude']),
        latestFillLevel: j['latest_fill_level'] as String?,
        latestFillPercentage: _dNull(j['latest_fill_percentage']),
        latestRiskLevel: j['latest_risk_level'] as String?,
        latestCapturedAt: j['latest_captured_at'] as String?,
        latestImageUrl: j['latest_image_url'] as String?,
        latestSourceType: j['latest_source_type'] as String?,
      );
}

class NearestBinResult extends Bin {
  final double distanceMeters;

  const NearestBinResult({
    required super.id,
    required super.name,
    super.location,
    super.address,
    required super.latitude,
    required super.longitude,
    super.latestFillLevel,
    super.latestFillPercentage,
    super.latestRiskLevel,
    super.latestCapturedAt,
    super.latestImageUrl,
    super.latestSourceType,
    required this.distanceMeters,
  });

  factory NearestBinResult.fromJson(Map<String, dynamic> j) =>
      NearestBinResult(
        id: (j['id'] as num).toInt(),
        name: j['name'] as String? ?? 'Bin ${j['id']}',
        location: j['location'] as String?,
        address: j['address'] as String?,
        latitude: _d(j['latitude']),
        longitude: _d(j['longitude']),
        latestFillLevel: j['latest_fill_level'] as String?,
        latestFillPercentage: _dNull(j['latest_fill_percentage']),
        latestRiskLevel: j['latest_risk_level'] as String?,
        latestCapturedAt: j['latest_captured_at'] as String?,
        latestImageUrl: j['latest_image_url'] as String?,
        latestSourceType: j['latest_source_type'] as String?,
        distanceMeters: _d(j['distance_meters']),
      );

  String get formattedDistance {
    if (distanceMeters < 1000) return '${distanceMeters.round()} m';
    return '${(distanceMeters / 1000).toStringAsFixed(1)} km';
  }
}

class BinLatestExtras {
  final String? wasteLabel;
  final double? wasteConfidence;
  final int? animalCount;
  final String? riskLevel;
  final String? riskCase;
  final double? tempC;
  final double? humidityPct;
  final double? fillPercentage;

  const BinLatestExtras({
    this.wasteLabel,
    this.wasteConfidence,
    this.animalCount,
    this.riskLevel,
    this.riskCase,
    this.tempC,
    this.humidityPct,
    this.fillPercentage,
  });

  factory BinLatestExtras.fromJson(Map<String, dynamic> j) => BinLatestExtras(
        wasteLabel: j['waste_label'] as String?,
        wasteConfidence: _dNull(j['waste_confidence']),
        animalCount: (j['animal_count'] as num?)?.toInt(),
        riskLevel: j['risk_level'] as String?,
        riskCase: j['risk_case'] as String?,
        tempC: _dNull(j['temp_c']),
        humidityPct: _dNull(j['humidity_pct']),
        fillPercentage: _dNull(j['fill_percentage']),
      );
}

class BinLatest {
  final Bin device;
  final String? capturedAt;
  final String? fillLevel;
  final String? modelName;
  final BinLatestExtras? extras;
  final String? imageUrl;

  const BinLatest({
    required this.device,
    this.capturedAt,
    this.fillLevel,
    this.modelName,
    this.extras,
    this.imageUrl,
  });

  factory BinLatest.fromJson(Map<String, dynamic> j) {
    final d = j['device'] as Map<String, dynamic>;
    final l = j['latest'] as Map<String, dynamic>? ?? {};
    final img = l['image'] as Map<String, dynamic>?;
    return BinLatest(
      device: Bin.fromJson(d),
      capturedAt: l['captured_at'] as String?,
      fillLevel: l['fill_level'] as String?,
      modelName: l['model_name'] as String?,
      extras: l['extras'] != null
          ? BinLatestExtras.fromJson(l['extras'] as Map<String, dynamic>)
          : null,
      imageUrl: img?['url'] as String?,
    );
  }
}

class AuthUser {
  final int id;
  final String email;
  final String role;
  final String? name;
  final String? municipalCouncil;
  final String? coveredArea;

  const AuthUser({
    required this.id,
    required this.email,
    required this.role,
    this.name,
    this.municipalCouncil,
    this.coveredArea,
  });

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: (j['id'] as num).toInt(),
        email: j['email'] as String,
        role: j['role'] as String,
        name: j['name'] as String? ?? j['adminName'] as String?,
        municipalCouncil: j['municipalCouncil'] as String?,
        coveredArea: j['coveredArea'] as String?,
      );
}

class RouteResult {
  final List<List<double>> path;
  final bool approximate;

  const RouteResult({required this.path, required this.approximate});
}

// helpers
double _d(dynamic v) {
  if (v == null) return 0.0;
  return (v as num).toDouble();
}

double? _dNull(dynamic v) {
  if (v == null) return null;
  return (v as num).toDouble();
}
