import 'package:flutter_test/flutter_test.dart';
import 'package:indoornav_mobile/main.dart';

void main() {
  testWidgets('App load smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const IndoorNavApp());

    // Verify that the Welcome screen is loaded and shows 'Discover'
    expect(find.text('Discover'), findsOneWidget);
  });
}
