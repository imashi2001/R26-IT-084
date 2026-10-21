import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../domain/models.dart';

const _kToken = 'vw_token';
const _kUser  = 'vw_user';

class AuthStorage {
  AuthStorage._();
  static final instance = AuthStorage._();

  final _s = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void> save(String token, AuthUser user) async {
    await _s.write(key: _kToken, value: token);
    await _s.write(key: _kUser, value: jsonEncode({
      'id': user.id,
      'email': user.email,
      'role': user.role,
      'name': user.name,
      'municipalCouncil': user.municipalCouncil,
      'coveredArea': user.coveredArea,
    }));
  }

  Future<String?> readToken() => _s.read(key: _kToken);

  Future<AuthUser?> readUser() async {
    final raw = await _s.read(key: _kUser);
    if (raw == null) return null;
    try {
      return AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    await _s.delete(key: _kToken);
    await _s.delete(key: _kUser);
  }
}
