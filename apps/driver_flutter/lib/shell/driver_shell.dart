import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../theme/lux_colors.dart';

class DriverShell extends StatelessWidget {
  const DriverShell({super.key, required this.navigationShell});
  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LuxColors.background,
      body: navigationShell,
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: LuxColors.line)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _item(0, Icons.today_outlined, 'My Day'),
              _item(1, Icons.bolt_outlined, 'Offers'),
              _item(2, Icons.route_outlined, 'Trips'),
              _item(3, Icons.payments_outlined, 'Earnings'),
              _item(4, Icons.menu, 'More'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _item(int i, IconData icon, String label) {
    final selected = navigationShell.currentIndex == i;
    return InkWell(
      onTap: () => navigationShell.goBranch(i),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: selected ? LuxColors.ink : LuxColors.muted),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
              color: selected ? LuxColors.ink : LuxColors.muted,
            ),
          ),
        ],
      ),
    );
  }
}
