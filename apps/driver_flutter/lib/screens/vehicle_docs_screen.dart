import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../services/driver_api.dart';
import '../theme/lux_colors.dart';
import '../theme/lux_spacing.dart';
import '../theme/lux_typography.dart';
import '../widgets/lux_chrome.dart';
import '../widgets/lux_feedback.dart';

class VehicleDocsScreen extends StatefulWidget {
  const VehicleDocsScreen({super.key});

  @override
  State<VehicleDocsScreen> createState() => _VehicleDocsScreenState();
}

class _VehicleDocsScreenState extends State<VehicleDocsScreen> {
  String? _busyDocId;

  Future<void> _upload(String documentId, ImageSource source) async {
    if (_busyDocId != null) return;
    setState(() => _busyDocId = documentId);
    try {
      final shot = await ImagePicker().pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 2400,
      );
      if (shot == null) return;

      final lower = shot.name.toLowerCase();
      final contentType = lower.endsWith('.png')
          ? 'image/png'
          : lower.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';

      await DriverApi.instance.submitDocumentFile(
        documentId: documentId,
        file: File(shot.path),
        contentType: contentType,
        fileName: shot.name,
      );
      if (!mounted) return;
      LuxFeedback.show(
        context,
        message: 'Uploaded — waiting for ops review',
        kind: LuxToastKind.success,
      );
    } catch (e) {
      if (!mounted) return;
      LuxFeedback.show(
        context,
        message: DriverApi.instance.mapError(e),
        kind: LuxToastKind.error,
      );
    } finally {
      if (mounted) setState(() => _busyDocId = null);
    }
  }

  void _showUploadSheet(String documentId, String label) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Upload · $label',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Take a clear photo of the document (JPEG / PNG / WEBP).',
                  style: LuxTypography.bodyMuted,
                ),
                const SizedBox(height: 16),
                LuxPrimaryButton(
                  label: 'Take photo',
                  onPressed: () {
                    Navigator.pop(ctx);
                    _upload(documentId, ImageSource.camera);
                  },
                ),
                const SizedBox(height: 10),
                OutlinedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _upload(documentId, ImageSource.gallery);
                  },
                  child: const Text('Choose from gallery'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;

    return Scaffold(
      backgroundColor: LuxColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(LuxSpacing.screenH),
          children: [
            LuxScreenHeader(
              title: 'Vehicle & docs',
              onBack: () => context.pop(),
            ),
            const SizedBox(height: 8),
            Text(
              'Vehicle & Documents',
              style: LuxTypography.display(context),
            ),
            const SizedBox(height: 8),
            const Text(
              'Upload each required document. Ops reviews the file, then marks eligibility so you can go online.',
              style: LuxTypography.bodyMuted,
            ),
            const SizedBox(height: LuxSpacing.md),
            if (uid == null)
              LuxCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Sign in required'),
                    const SizedBox(height: 12),
                    LuxPrimaryButton(
                      label: 'Sign in',
                      onPressed: () => context.go('/auth'),
                    ),
                  ],
                ),
              )
            else
              StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
                stream: FirebaseFirestore.instance
                    .collection('drivers')
                    .doc(uid)
                    .snapshots(),
                builder: (context, driverSnap) {
                  final driver = driverSnap.data?.data();
                  if (driver == null) {
                    return const LuxCard(
                      child: Text(
                        'Driver profile not found. Sign out and sign in again to provision.',
                      ),
                    );
                  }
                  final vehicleId = driver['currentVehicleId'] as String?;
                  final status = driver['status'] as String? ?? 'UNKNOWN';

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      LuxCard(
                        color: LuxColors.lime.withValues(alpha: 0.35),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Driver status · $status',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              driver['statusReason'] as String? ??
                                  'Awaiting ops approval',
                              style: const TextStyle(color: LuxColors.muted),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (vehicleId == null)
                        const LuxCard(
                          child: Text('No vehicle linked to this driver yet.'),
                        )
                      else ...[
                        StreamBuilder<
                            DocumentSnapshot<Map<String, dynamic>>>(
                          stream: FirebaseFirestore.instance
                              .collection('vehicles')
                              .doc(vehicleId)
                              .snapshots(),
                          builder: (context, vehSnap) {
                            final v = vehSnap.data?.data();
                            if (v == null) {
                              return LuxCard(
                                child: Text('Vehicle $vehicleId not found.'),
                              );
                            }
                            final approved = v['status'] == 'APPROVED';
                            final docsOk = v['documentEligibilityOk'] == true;
                            final inspection =
                                v['inspectionStatus'] as String? ?? 'UNKNOWN';
                            final checklist = Map<String, dynamic>.from(
                              v['reviewChecklist'] as Map? ?? {},
                            );
                            return LuxCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${v['make'] ?? ''} ${v['model'] ?? ''} (${v['year'] ?? ''})'
                                        .trim(),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 18,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text('Plate · ${v['plate'] ?? '—'}'),
                                  Text(
                                    'Classes · ${((v['classIds'] as List?) ?? []).join(', ')}',
                                  ),
                                  const SizedBox(height: 12),
                                  _StatusRow(
                                    label: 'Vehicle approval',
                                    value: '${v['status']}',
                                    ok: approved,
                                  ),
                                  _StatusRow(
                                    label: 'Inspection',
                                    value: inspection,
                                    ok: inspection == 'PASSED',
                                  ),
                                  _StatusRow(
                                    label: 'Document eligibility',
                                    value: docsOk ? 'OK' : 'Pending ops',
                                    ok: docsOk,
                                  ),
                                  const SizedBox(height: 10),
                                  const Text(
                                    'Ops vehicle checklist',
                                    style:
                                        TextStyle(fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: 6),
                                  _CheckLine(
                                    'Plate verified',
                                    checklist['plateVerified'] == true,
                                  ),
                                  _CheckLine(
                                    'Class confirmed',
                                    checklist['classConfirmed'] == true,
                                  ),
                                  _CheckLine(
                                    'Photos reviewed',
                                    checklist['photosReviewed'] == true,
                                  ),
                                  _CheckLine(
                                    'Inspection passed',
                                    checklist['inspectionPassed'] == true,
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: LuxSpacing.md),
                        const LuxSectionLabel('Document checklist'),
                        const SizedBox(height: 8),
                        StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
                          stream: FirebaseFirestore.instance
                              .collection('driver_documents')
                              .where('driverId', isEqualTo: uid)
                              .where('vehicleId', isEqualTo: vehicleId)
                              .snapshots(),
                          builder: (context, docsSnap) {
                            final docs = docsSnap.data?.docs ?? [];
                            if (docs.isEmpty) {
                              return const LuxCard(
                                child: Text(
                                  'No checklist documents yet. Re-sign in if this stays empty.',
                                ),
                              );
                            }
                            return Column(
                              children: docs.map((d) {
                                final data = d.data();
                                final documentId =
                                    data['documentId'] as String? ?? d.id;
                                final status =
                                    data['status'] as String? ?? 'PENDING';
                                final label = data['label'] as String? ??
                                    data['type']?.toString() ??
                                    'Document';
                                final hasFile =
                                    (data['storagePath'] as String?)
                                            ?.isNotEmpty ==
                                        true;
                                final approved = status == 'APPROVED';
                                final canUpload = !approved;
                                final busy = _busyDocId == documentId;

                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: LuxCard(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Icon(
                                              approved
                                                  ? Icons.check_circle
                                                  : status == 'SUBMITTED'
                                                      ? Icons
                                                          .hourglass_top_rounded
                                                      : status == 'REJECTED'
                                                          ? Icons.cancel_outlined
                                                          : Icons
                                                              .upload_file_outlined,
                                              color: approved
                                                  ? const Color(0xFF2F7D32)
                                                  : status == 'REJECTED'
                                                      ? LuxColors.danger
                                                      : LuxColors.muted,
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.start,
                                                children: [
                                                  Text(
                                                    label,
                                                    style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.w800,
                                                    ),
                                                  ),
                                                  Text(
                                                    status +
                                                        (hasFile &&
                                                                status !=
                                                                    'APPROVED'
                                                            ? ' · file on file'
                                                            : ''),
                                                    style: TextStyle(
                                                      color: approved
                                                          ? const Color(
                                                              0xFF2F7D32)
                                                          : LuxColors.muted,
                                                    ),
                                                  ),
                                                  if (data['reviewNotes'] !=
                                                          null &&
                                                      status == 'REJECTED')
                                                    Padding(
                                                      padding:
                                                          const EdgeInsets.only(
                                                        top: 4,
                                                      ),
                                                      child: Text(
                                                        'Ops: ${data['reviewNotes']}',
                                                        style: const TextStyle(
                                                          color:
                                                              LuxColors.danger,
                                                          fontSize: 12,
                                                        ),
                                                      ),
                                                    ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        if (canUpload) ...[
                                          const SizedBox(height: 12),
                                          LuxPrimaryButton(
                                            label: hasFile
                                                ? 'Replace file'
                                                : 'Upload document',
                                            loading: busy,
                                            enabled: !busy,
                                            onPressed: () => _showUploadSheet(
                                              documentId,
                                              label,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                );
                              }).toList(),
                            );
                          },
                        ),
                      ],
                    ],
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _StatusRow extends StatelessWidget {
  const _StatusRow({
    required this.label,
    required this.value,
    required this.ok,
  });
  final String label;
  final String value;
  final bool ok;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(
            ok ? Icons.check_circle : Icons.cancel_outlined,
            size: 18,
            color: ok ? const Color(0xFF2F7D32) : LuxColors.danger,
          ),
          const SizedBox(width: 8),
          Expanded(child: Text('$label · $value')),
        ],
      ),
    );
  }
}

class _CheckLine extends StatelessWidget {
  const _CheckLine(this.label, this.ok);
  final String label;
  final bool ok;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(
            ok ? Icons.check : Icons.close,
            size: 16,
            color: ok ? const Color(0xFF2F7D32) : LuxColors.muted,
          ),
          const SizedBox(width: 6),
          Text(label),
        ],
      ),
    );
  }
}
