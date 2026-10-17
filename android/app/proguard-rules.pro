# Only the two bridge methods are reachable from JavaScript.
-keepclassmembers class com.example.arrowflow.AdsBridge {
    @android.webkit.JavascriptInterface <methods>;
}
