package br.nossosim.iris;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Nosso Sim + Íris: WebView sem dependências. Serve os arquivos do APK em https://appassets.androidplatform.net
 * (contexto seguro, origem estável para localStorage/IndexedDB) e expõe uma ponte nativa para
 * reconhecimento de voz, síntese de voz, salvar arquivos e botão voltar. O WebView NÃO tem Web Speech API.
 * O app só carrega a própria origem; qualquer outro endereço abre no navegador do sistema.
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String ORIGIN = "https://" + HOST;
    static final int REQ_FILE = 11, REQ_MIC = 12, REQ_MIC_WEB = 13;

    private WebView web;
    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingWebPermission;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(0xFF583B45);
        getWindow().setNavigationBarColor(0xFFFBF9F6);
        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(0xFFFBF9F6);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportZoom(false);
        s.setUserAgentString(s.getUserAgentString() + " NossoSimIris/3.0");

        web.addJavascriptInterface(new Bridge(), "IrisAndroid");
        web.setWebViewClient(new AssetClient());
        web.setWebChromeClient(new ChromeClient());
        initTts();

        if (b != null) web.restoreState(b); else web.loadUrl(startUrl(getIntent()));
    }

    private String startUrl(Intent i) {
        Uri d = i == null ? null : i.getData();
        if (d != null && HOST.equals(d.getHost()) && "1".equals(d.getQueryParameter("iris"))) return ORIGIN + "/index.html?iris=1";
        return ORIGIN + "/index.html";
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        Uri d = i.getData();
        if (d != null && "1".equals(d.getQueryParameter("iris"))) web.loadUrl(ORIGIN + "/index.html?iris=1");
    }

    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    // ---------- arquivos do APK como se fossem um site https ----------
    private class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (!HOST.equals(u.getHost())) return null; // outros destinos seguem a rede (a CSP da página restringe)
            String path = u.getPath() == null ? "" : u.getPath();
            if (path.startsWith("/")) path = path.substring(1);
            if (path.length() == 0) path = "index.html";
            if (path.contains("..")) return notFound();
            try {
                InputStream in = getAssets().open("www/" + path);
                Map<String, String> h = new HashMap<String, String>();
                h.put("Cache-Control", "no-cache");
                h.put("X-Content-Type-Options", "nosniff");
                return new WebResourceResponse(mime(path), "utf-8", 200, "OK", h, in);
            } catch (IOException e) {
                return notFound();
            }
        }

        private WebResourceResponse notFound() {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
        }

        // API 24+: o framework chama esta assinatura (o android.jar de compilação é da API 23, por isso sem @Override)
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return route(r.getUrl()); }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, String url) { return route(Uri.parse(url)); }

        private boolean route(Uri u) {
            if (HOST.equals(u.getHost())) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
            return true; // nunca navega para fora da própria origem dentro do WebView
        }
    }

    static String mime(String p) {
        String l = p.toLowerCase(Locale.ROOT);
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".js")) return "text/javascript";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".json")) return "application/json";
        if (l.endsWith(".webmanifest")) return "application/manifest+json";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
        if (l.endsWith(".svg")) return "image/svg+xml";
        if (l.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    // ---------- seletor de arquivos (importar backup / foto) e permissão de câmera/mic da web ----------
    private class ChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (filePathCallback != null) filePathCallback.onReceiveValue(null);
            filePathCallback = cb;
            try { startActivityForResult(p.createIntent(), REQ_FILE); }
            catch (ActivityNotFoundException e) { filePathCallback = null; return false; }
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest req) {
            // só a própria origem; usado pelo STT remoto opcional (MediaRecorder)
            if (!ORIGIN.equals(req.getOrigin().toString().replaceAll("/$", ""))) { req.deny(); return; }
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) { req.grant(req.getResources()); return; }
            pendingWebPermission = req;
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC_WEB);
        }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code == REQ_FILE && filePathCallback != null) {
            filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            filePathCallback = null;
        } else super.onActivityResult(code, result, data);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        if (code == REQ_MIC) js("IrisNativeCb.onPerm(" + ok + ")");
        if (code == REQ_MIC_WEB && pendingWebPermission != null) {
            if (ok) pendingWebPermission.grant(pendingWebPermission.getResources()); else pendingWebPermission.deny();
            pendingWebPermission = null;
        }
    }

    // ---------- voltar / ciclo de vida ----------
    @Override
    public void onBackPressed() {
        String script = "(function(){try{var r=document.getElementById('iris-root');if(r&&!r.hidden){Iris.app.panel.close();return true;}"
                + "var m=document.getElementById('modal-root');if(m&&m.innerHTML){m.innerHTML='';return true;}}catch(e){}return false;})()";
        web.evaluateJavascript(script, new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) { if (!"true".equals(v)) finish(); }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (recognizer != null) recognizer.cancel(); // o microfone nunca fica ligado em segundo plano
        if (tts != null) tts.stop();
        web.onPause();
    }

    @Override protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    protected void onDestroy() {
        if (recognizer != null) { recognizer.destroy(); recognizer = null; }
        if (tts != null) { tts.shutdown(); tts = null; }
        web.destroy();
        super.onDestroy();
    }

    // ---------- util JS ----------
    static String q(String s) {
        if (s == null) return "\"\"";
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c == '\n') b.append("\\n");
            else if (c == '\r') b.append("\\r");
            else if (c == ' ') b.append("\\u2028");
            else if (c == ' ') b.append("\\u2029");
            else if (c < 32) b.append(' ');
            else b.append(c);
        }
        return b.append('"').toString();
    }

    private void js(final String code) {
        main.post(new Runnable() { @Override public void run() { if (web != null) web.evaluateJavascript("window.IrisNativeCb&&" + code, null); } });
    }

    // ---------- síntese de voz nativa ----------
    private void initTts() {
        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override public void onInit(int status) {
                ttsReady = status == TextToSpeech.SUCCESS;
                if (ttsReady) {
                    tts.setLanguage(new Locale("pt", "BR"));
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String id) { js("IrisNativeCb.onTts(" + q(id) + ",\"start\",\"\")"); }
                        @Override public void onDone(String id) { js("IrisNativeCb.onTts(" + q(id) + ",\"done\",\"\")"); }
                        @Override public void onError(String id) { js("IrisNativeCb.onTts(" + q(id) + ",\"error\",\"\")"); }
                    });
                }
            }
        });
    }

    // ---------- ponte exposta ao JavaScript (só a origem do próprio app é carregada) ----------
    public class Bridge {
        @JavascriptInterface public String version() { return "3.0"; }

        @JavascriptInterface public boolean isRecognitionAvailable() { return SpeechRecognizer.isRecognitionAvailable(MainActivity.this); }

        @JavascriptInterface public boolean hasMicPermission() { return checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED; }

        @JavascriptInterface public void requestMicPermission() {
            runOnUiThread(new Runnable() { @Override public void run() { requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC); } });
        }

        @JavascriptInterface public void startListening() {
            runOnUiThread(new Runnable() { @Override public void run() { beginRecognition(); } });
        }

        @JavascriptInterface public void stopListening() {
            runOnUiThread(new Runnable() { @Override public void run() { if (recognizer != null) recognizer.stopListening(); } });
        }

        @JavascriptInterface public void cancelListening() {
            runOnUiThread(new Runnable() { @Override public void run() { if (recognizer != null) recognizer.cancel(); } });
        }

        @JavascriptInterface public boolean isTtsReady() { return ttsReady; }

        @JavascriptInterface public boolean hasPtVoice() {
            if (!ttsReady) return false;
            int r = tts.isLanguageAvailable(new Locale("pt", "BR"));
            return r >= TextToSpeech.LANG_AVAILABLE;
        }

        @JavascriptInterface public void speak(final String id, final String text, final float rate, final float volume) {
            runOnUiThread(new Runnable() { @Override public void run() {
                if (!ttsReady) { js("IrisNativeCb.onTts(" + q(id) + ",\"error\",\"sem-motor\")"); return; }
                tts.setSpeechRate(Math.max(0.5f, Math.min(2f, rate)));
                Bundle p = new Bundle();
                p.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.max(0f, Math.min(1f, volume)));
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, p, id);
            } });
        }

        @JavascriptInterface public void stopSpeaking() {
            runOnUiThread(new Runnable() { @Override public void run() { if (tts != null) tts.stop(); } });
        }

        /** Salva texto em Downloads (Android 10+) ou na pasta do app (versões anteriores). Retorna o local ou "ERRO: ...". */
        @JavascriptInterface public String saveFile(String name, String text) {
            try {
                String safe = name.replaceAll("[^A-Za-z0-9._-]", "_");
                byte[] data = text.getBytes("UTF-8");
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put("_display_name", safe);
                    v.put("mime_type", "application/json");
                    v.put("relative_path", "Download/");
                    Class<?> c = Class.forName("android.provider.MediaStore$Downloads");
                    Uri table = (Uri) c.getField("EXTERNAL_CONTENT_URI").get(null);
                    Uri u = getContentResolver().insert(table, v);
                    if (u == null) return "ERRO: não consegui criar o arquivo";
                    OutputStream o = getContentResolver().openOutputStream(u);
                    o.write(data); o.close();
                    return "Downloads/" + safe;
                }
                File f = new File(getExternalFilesDir(null), safe);
                FileOutputStream o = new FileOutputStream(f);
                o.write(data); o.close();
                return f.getAbsolutePath();
            } catch (Exception e) {
                return "ERRO: " + e.getMessage();
            }
        }
    }

    // ---------- reconhecimento de voz nativo (SpeechRecognizer do Android) ----------
    private void beginRecognition() {
        if (recognizer != null) { recognizer.destroy(); recognizer = null; }
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle p) { js("IrisNativeCb.onStt(\"start\",\"\")"); }
            @Override public void onBeginningOfSpeech() { js("IrisNativeCb.onStt(\"sound\",\"\")"); }
            @Override public void onRmsChanged(float v) { }
            @Override public void onBufferReceived(byte[] b) { }
            @Override public void onEndOfSpeech() { }
            @Override public void onEvent(int t, Bundle p) { }
            @Override public void onPartialResults(Bundle b) {
                ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (r != null && !r.isEmpty()) js("IrisNativeCb.onStt(\"partial\"," + q(r.get(0)) + ")");
            }
            @Override public void onResults(Bundle b) {
                ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (r != null && !r.isEmpty()) js("IrisNativeCb.onStt(\"final\"," + q(r.get(0)) + ")");
                else js("IrisNativeCb.onStt(\"error\",\"no-speech\")");
                js("IrisNativeCb.onStt(\"end\",\"\")");
            }
            @Override public void onError(int e) {
                String code;
                switch (e) {
                    case SpeechRecognizer.ERROR_NO_MATCH:
                    case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: code = "no-speech"; break;
                    case SpeechRecognizer.ERROR_NETWORK:
                    case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                    case SpeechRecognizer.ERROR_SERVER: code = "network"; break;
                    case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: code = "not-allowed"; break;
                    case SpeechRecognizer.ERROR_AUDIO: code = "audio-capture"; break;
                    case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: code = "busy"; break;
                    default: code = "start-failed";
                }
                js("IrisNativeCb.onStt(\"error\"," + q(code) + ")");
                js("IrisNativeCb.onStt(\"end\",\"\")");
            }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        recognizer.startListening(i);
    }
}
