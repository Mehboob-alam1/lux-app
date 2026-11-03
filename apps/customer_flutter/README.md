# LUX Customer (Flutter)

Linked to Firebase project **`uberclone-6e4a0`** (`lib/firebase_options.dart` + `android/app/google-services.json`).

## Open in Android Studio

1. Install the **Flutter** and **Dart** plugins in Android Studio.
2. **File → Open** and select this folder:
   `apps/customer_flutter`  
   (open the Flutter project root — not only the `android/` subfolder).
3. Wait for Gradle sync / `pub get`.
4. Pick an Android emulator or USB device.
5. Run ▶ `main.dart` (configuration: `main.dart`).

### CLI alternative

```bash
export PATH="$HOME/development/flutter/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd apps/customer_flutter
flutter pub get
flutter run
```

### Local emulators (optional)

```bash
flutter run --dart-define=USE_EMULATORS=true
```

Package id: `com.luxmobility.lux_customer`
