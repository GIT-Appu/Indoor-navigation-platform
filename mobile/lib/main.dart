import 'package:flutter/material.dart';

void main() {
  runApp(const IndoorNavApp());
}

class IndoorNavApp extends StatelessWidget {
  const IndoorNavApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'IndoorNav',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF111111),
        fontFamily: 'Roboto',
      ),
      home: const WelcomeScreen(),
    );
  }
}

/// A custom painter to draw an elegant stylized indoor node graph overlay.
/// It renders nodes, edges, a glowing shortest path, and an active pulsing pin.
class StylizedMapPainter extends CustomPainter {
  final double animationValue;

  StylizedMapPainter({required this.animationValue});

  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = const Color(0xFF2F2F2F).withOpacity(0.4)
      ..strokeWidth = 1.0;

    // 1. Draw background grid lines
    const gridSpacing = 30.0;
    for (double x = 0; x < size.width; x += gridSpacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += gridSpacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // 2. Define node positions for a stylized path
    final nodes = [
      Offset(size.width * 0.15, size.height * 0.75),
      Offset(size.width * 0.40, size.height * 0.70),
      Offset(size.width * 0.35, size.height * 0.40),
      Offset(size.width * 0.65, size.height * 0.35),
      Offset(size.width * 0.85, size.height * 0.20),
      // Distractor nodes
      Offset(size.width * 0.20, size.height * 0.25),
      Offset(size.width * 0.70, size.height * 0.75),
      Offset(size.width * 0.80, size.height * 0.55),
    ];

    final edges = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Path edges
      [0, 5], [5, 2], [1, 6], [6, 7], [7, 4], [3, 7] // Distractor edges
    ];

    // 3. Draw edges (Normal paths in gray, active path in glowing gold)
    final edgePaint = Paint()
      ..color = const Color(0xFF2F2F2F)
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    final activeEdgePaint = Paint()
      ..color = const Color(0xFFFFCB74)
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2.0);

    for (final edge in edges) {
      final p1 = nodes[edge[0]];
      final p2 = nodes[edge[1]];
      
      // Check if this edge belongs to the active route path
      final isPathEdge = (edge[0] == 0 && edge[1] == 1) ||
                          (edge[0] == 1 && edge[1] == 2) ||
                          (edge[0] == 2 && edge[1] == 3) ||
                          (edge[0] == 3 && edge[1] == 4);

      canvas.drawLine(p1, p2, isPathEdge ? activeEdgePaint : edgePaint);
    }

    // 4. Draw standard nodes
    final nodePaint = Paint()
      ..color = const Color(0xFF2F2F2F)
      ..style = PaintingStyle.fill;

    final nodeBorderPaint = Paint()
      ..color = const Color(0xFF111111)
      ..style = PaintingStyle.stroke;

    final activeNodePaint = Paint()
      ..color = const Color(0xFFFFCB74)
      ..style = PaintingStyle.fill;

    for (int i = 0; i < nodes.length; i++) {
      final p = nodes[i];
      final isPathNode = i <= 4;
      
      if (isPathNode) {
        canvas.drawCircle(p, 7.0, activeNodePaint);
        canvas.drawCircle(p, 7.0, nodeBorderPaint);
      } else {
        canvas.drawCircle(p, 5.0, nodePaint);
        canvas.drawCircle(p, 5.0, nodeBorderPaint);
      }
    }

    // 5. Pulsing halo on Start Node (Node 0)
    final pulsePaint = Paint()
      ..color = const Color(0xFFFFCB74).withOpacity(1.0 - animationValue)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;
    canvas.drawCircle(nodes[0], 7.0 + (animationValue * 15.0), pulsePaint);

    // 6. Draw location marker on Destination Node (Node 4)
    final markerPaint = Paint()
      ..color = const Color(0xFFFFCB74)
      ..style = PaintingStyle.fill;
    
    final markerPos = nodes[4] + const Offset(0, -12);
    final path = Path()
      ..moveTo(markerPos.dx, markerPos.dy)
      ..quadraticBezierTo(markerPos.dx - 8, markerPos.dy - 8, markerPos.dx - 8, markerPos.dy - 16)
      ..arcToPoint(Offset(markerPos.dx + 8, markerPos.dy - 16), radius: const Radius.circular(8.0))
      ..quadraticBezierTo(markerPos.dx + 8, markerPos.dy - 8, markerPos.dx, markerPos.dy)
      ..close();
    canvas.drawPath(path, markerPaint);

    // Inner pin dot
    canvas.drawCircle(Offset(markerPos.dx, markerPos.dy - 16), 3.0, Paint()..color = const Color(0xFF111111));
  }

  @override
  bool shouldRepaint(covariant StylizedMapPainter oldDelegate) {
    return oldDelegate.animationValue != animationValue;
  }
}

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  int _selectedCategoryIndex = 0;

  final List<Map<String, dynamic>> _categories = [
    {'name': 'All', 'icon': Icons.grid_view_rounded},
    {'name': 'Malls', 'icon': Icons.storefront_rounded},
    {'name': 'Schools', 'icon': Icons.school_rounded},
    {'name': 'Hospitals', 'icon': Icons.local_hospital_rounded},
    {'name': 'Airports', 'icon': Icons.flight_takeoff_rounded},
  ];

  final List<Map<String, dynamic>> _venues = [
    {
      'name': 'Model Engineering College',
      'subtitle': 'Main Academic Block',
      'location': 'Kochi, Kerala',
      'buildings': '3 Buildings',
      'floors': '12 Floors',
      'distance': '1.2 km',
      'image': 'college',
    },
    {
      'name': 'Grand Plaza Mall',
      'subtitle': 'Shopping & Entertainment',
      'location': 'Downtown Bay Area',
      'buildings': '1 Complex',
      'floors': '5 Floors',
      'distance': '4.8 km',
      'image': 'mall',
    },
  ];

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Headers / Profile Segment
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Discover',
                        style: TextStyle(
                          fontSize: 32.0,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFFF6F6F6),
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 4.0),
                      Row(
                        children: [
                          Container(
                            width: 8.0,
                            height: 8.0,
                            decoration: const BoxDecoration(
                              color: Color(0xFFFFCB74),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8.0),
                          Text(
                            'IndoorNav GPS Simulator',
                            style: TextStyle(
                              fontSize: 13.0,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFFF6F6F6).withOpacity(0.6),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Container(
                    width: 48.0,
                    height: 48.0,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2F2F2F),
                      borderRadius: BorderRadius.circular(16.0),
                      border: Border.all(
                        color: const Color(0xFFF6F6F6).withOpacity(0.08),
                        width: 1.0,
                      ),
                    ),
                    child: const Icon(
                      Icons.person_outline_rounded,
                      color: Color(0xFFF6F6F6),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28.0),

              // Search Bar Card (Inspired by Screen 1 of Design)
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF2F2F2F),
                  borderRadius: BorderRadius.circular(24.0),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 20.0,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
                child: TextField(
                  style: const TextStyle(color: Color(0xFFF6F6F6), fontSize: 16.0),
                  decoration: InputDecoration(
                    hintText: 'Search for indoor venues...',
                    hintStyle: TextStyle(color: const Color(0xFFF6F6F6).withOpacity(0.4)),
                    border: InputBorder.none,
                    icon: const Icon(Icons.search_rounded, color: Color(0xFFFFCB74)),
                  ),
                ),
              ),
              const SizedBox(height: 28.0),

              // Category Groups (Inspired by Screen 1 "Groups" row)
              SizedBox(
                height: 46.0,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: _categories.length,
                  itemBuilder: (context, index) {
                    final isSelected = _selectedCategoryIndex == index;
                    return Padding(
                      padding: const EdgeInsets.only(right: 12.0),
                      child: GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedCategoryIndex = index;
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 20.0),
                          decoration: BoxDecoration(
                            color: isSelected ? const Color(0xFFFFCB74) : const Color(0xFF2F2F2F),
                            borderRadius: BorderRadius.circular(16.0),
                            border: Border.all(
                              color: isSelected
                                  ? Colors.transparent
                                  : const Color(0xFFF6F6F6).withOpacity(0.05),
                              width: 1.0,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                _categories[index]['icon'] as IconData,
                                size: 18.0,
                                color: isSelected ? const Color(0xFF111111) : const Color(0xFFF6F6F6),
                              ),
                              const SizedBox(width: 8.0),
                              Text(
                                _categories[index]['name'] as String,
                                style: TextStyle(
                                  color: isSelected ? const Color(0xFF111111) : const Color(0xFFF6F6F6),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14.0,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 28.0),

              // Decorative Abstract Map Segment (Inspired by Screen 3 of Design)
              Container(
                height: 180.0,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFF2F2F2F).withOpacity(0.5),
                  borderRadius: BorderRadius.circular(28.0),
                  border: Border.all(
                    color: const Color(0xFFF6F6F6).withOpacity(0.05),
                    width: 1.0,
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(28.0),
                  child: AnimatedBuilder(
                    animation: _pulseController,
                    builder: (context, child) {
                      return CustomPaint(
                        painter: StylizedMapPainter(
                          animationValue: _pulseController.value,
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 32.0),

              // Title Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Nearest Venues',
                    style: TextStyle(
                      fontSize: 22.0,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFFF6F6F6),
                      letterSpacing: -0.3,
                    ),
                  ),
                  Text(
                    'See all',
                    style: TextStyle(
                      fontSize: 14.0,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFFFFCB74),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16.0),

              // Venue Card List
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _venues.length,
                itemBuilder: (context, index) {
                  final venue = _venues[index];
                  return Container(
                    margin: const EdgeInsets.only(bottom: 20.0),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2F2F2F),
                      borderRadius: BorderRadius.circular(28.0),
                      border: Border.all(
                        color: const Color(0xFFF6F6F6).withOpacity(0.05),
                        width: 1.0,
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 56.0,
                                height: 56.0,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF111111),
                                  borderRadius: BorderRadius.circular(20.0),
                                ),
                                child: Icon(
                                  index == 0 ? Icons.school_rounded : Icons.storefront_rounded,
                                  color: const Color(0xFFFFCB74),
                                  size: 28.0,
                                ),
                              ),
                              const SizedBox(width: 16.0),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      venue['name'] as String,
                                      style: const TextStyle(
                                        fontSize: 18.0,
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFFF6F6F6),
                                        letterSpacing: -0.2,
                                      ),
                                    ),
                                    const SizedBox(height: 4.0),
                                    Text(
                                      venue['subtitle'] as String,
                                      style: TextStyle(
                                        fontSize: 14.0,
                                        color: const Color(0xFFF6F6F6).withOpacity(0.5),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20.0),
                          
                          // Quick Info Badges
                          Row(
                            children: [
                              _infoBadge(Icons.location_on_outlined, venue['location'] as String),
                              const SizedBox(width: 12.0),
                              _infoBadge(Icons.layers_outlined, venue['floors'] as String),
                              const Spacer(),
                              Text(
                                venue['distance'] as String,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFFFCB74),
                                  fontSize: 13.0,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20.0),

                          // Accent Arrow Button (Takes user to map screen)
                          GestureDetector(
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => MapScreen(venueName: venue['name'] as String),
                                ),
                              );
                            },
                            child: Container(
                              height: 54.0,
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFCB74),
                                borderRadius: BorderRadius.circular(18.0),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFFFFCB74).withOpacity(0.3),
                                    blurRadius: 12.0,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 20.0),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Enter Wayfinding Map',
                                    style: TextStyle(
                                      color: Color(0xFF111111),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15.0,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.all(6.0),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFF111111),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.arrow_forward_rounded,
                                      color: Color(0xFFFFCB74),
                                      size: 16.0,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoBadge(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 6.0),
      decoration: BoxDecoration(
        color: const Color(0xFF111111).withOpacity(0.5),
        borderRadius: BorderRadius.circular(10.0),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13.0, color: const Color(0xFFFFCB74)),
          const SizedBox(width: 6.0),
          Text(
            text,
            style: const TextStyle(
              fontSize: 11.0,
              fontWeight: FontWeight.w600,
              color: Color(0xFFF6F6F6),
            ),
          ),
        ],
      ),
    );
  }
}

/// The secondary blank map page.
/// It displays a back button and features a premium layout.
class MapScreen extends StatelessWidget {
  final String venueName;

  const MapScreen({super.key, required this.venueName});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0.0,
        leading: Padding(
          padding: const EdgeInsets.only(left: 16.0),
          child: Center(
            child: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                width: 40.0,
                height: 40.0,
                decoration: BoxDecoration(
                  color: const Color(0xFF2F2F2F),
                  borderRadius: BorderRadius.circular(12.0),
                  border: Border.all(
                    color: const Color(0xFFF6F6F6).withOpacity(0.08),
                    width: 1.0,
                  ),
                ),
                child: const Icon(
                  Icons.arrow_back_ios_new_rounded,
                  color: Color(0xFFF6F6F6),
                  size: 16.0,
                ),
              ),
            ),
          ),
        ),
        title: Text(
          'Wayfinding Map',
          style: TextStyle(
            fontSize: 18.0,
            fontWeight: FontWeight.w800,
            color: const Color(0xFFF6F6F6),
            letterSpacing: -0.3,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Stylized empty state map icon representation
              Center(
                child: Container(
                  width: 120.0,
                  height: 120.0,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2F2F2F).withOpacity(0.3),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFFFFCB74).withOpacity(0.2),
                      width: 1.5,
                    ),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.map_rounded,
                      color: Color(0xFFFFCB74),
                      size: 48.0,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24.0),
              Text(
                venueName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 24.0,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFFF6F6F6),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8.0),
              Text(
                '3D Map Canvas & PDR Sensor Engine Loading...',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14.0,
                  color: const Color(0xFFF6F6F6).withOpacity(0.5),
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 32.0),
              
              // Progress loading indicator representation
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 48.0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10.0),
                  child: const LinearProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFFCB74)),
                    backgroundColor: Color(0xFF2F2F2F),
                    minHeight: 4.0,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
