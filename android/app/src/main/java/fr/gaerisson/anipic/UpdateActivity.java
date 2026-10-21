package fr.gaerisson.anipic;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.*;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Updates only from our fixed HTTPS origin, pinned to the installed app signing certificate. */
public class UpdateActivity extends Activity {
    private static final String ORIGIN="https://anipic.gaerisson.fr";
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private TextView status;
    private ProgressBar progress;
    private Button action;
    private File verified;
    private volatile boolean cancelled;
    private boolean waitingPermission=false;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(48,100,48,48);layout.setBackgroundColor(0xff18191c);
        TextView title=new TextView(this);title.setText("Mise à jour AniPic");title.setTextSize(27);title.setTextColor(0xfffaf6f0);layout.addView(title);
        status=new TextView(this);status.setTextColor(0xffe9e1d8);status.setPadding(0,40,0,40);status.setTextSize(17);layout.addView(status);
        progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);layout.addView(progress);
        action=new Button(this);action.setText("Vérification…");action.setEnabled(false);action.setOnClickListener(v->{if(verified!=null)install();else download();});layout.addView(action);
        Button cancel=new Button(this);cancel.setText("Fermer");cancel.setOnClickListener(v->finish());layout.addView(cancel);setContentView(layout);
        download();
    }
    private void ui(String text){runOnUiThread(()->{if(!isFinishing())status.setText(text);});}
    private HttpsURLConnection connection(String path)throws Exception{
        HttpsURLConnection c=(HttpsURLConnection)new URL(ORIGIN+path).openConnection();c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setInstanceFollowRedirects(false);c.setRequestProperty("Accept","application/json, application/vnd.android.package-archive");
        if(c.getResponseCode()!=200){c.disconnect();throw new IOException("Le serveur est indisponible. Réessayez plus tard.");}return c;
    }
    private byte[] read(InputStream in,int max)throws Exception{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(cancelled)throw new IOException("Téléchargement annulé.");out.write(buf,0,n);if(out.size()>max)throw new IOException("Fichier trop volumineux.");}return out.toByteArray();}
    private void download(){action.setEnabled(false);progress.setProgress(0);ui("Recherche d’une version disponible…");executor.execute(()->{
        File partial=new File(getCacheDir(),"update-download.apk");
        try{
            HttpsURLConnection metadata=connection("/android-download.json");JSONObject m;
            try(InputStream in=metadata.getInputStream()){m=new JSONObject(new String(read(in,16384),java.nio.charset.StandardCharsets.UTF_8));}finally{metadata.disconnect();}
            PackageInfo current=getPackageManager().getPackageInfo(getPackageName(),signatureFlags());
            String filename=m.getString("filename"),version=m.getString("version"),sha=m.getString("sha256");long code=m.getLong("versionCode"),size=m.getLong("bytes");
            if(!getPackageName().equals(m.getString("packageId"))||!ORIGIN.equals(m.getString("siteUrl"))||!version.matches("\\d+\\.\\d+\\.\\d+")||!filename.equals("AniPic-"+version+".apk")||!sha.matches("[a-f0-9]{64}")||size<=0||size>32*1024*1024)throw new IOException("Métadonnées de mise à jour invalides.");
            if(code<=versionCode(current)){ui("Votre application est à jour.");runOnUiThread(()->{progress.setProgress(100);action.setText("À jour");});return;}
            ui("Téléchargement d’AniPic "+version+"…");HttpsURLConnection apk=connection("/downloads/"+filename);MessageDigest digest=MessageDigest.getInstance("SHA-256");long count=0;
            try(InputStream in=apk.getInputStream();OutputStream out=new FileOutputStream(partial)){byte[] buf=new byte[16384];int n;while((n=in.read(buf))!=-1){if(cancelled)throw new IOException("Téléchargement annulé.");count+=n;if(count>size)throw new IOException("Taille de fichier incohérente.");out.write(buf,0,n);digest.update(buf,0,n);final int pct=(int)(100*count/size);runOnUiThread(()->progress.setProgress(pct));}}finally{apk.disconnect();}
            if(count!=size||!hex(digest.digest()).equals(sha))throw new IOException("Vérification du téléchargement échouée. Aucune installation effectuée.");
            PackageInfo candidate=getPackageManager().getPackageArchiveInfo(partial.getAbsolutePath(),signatureFlags());
            if(candidate==null||!getPackageName().equals(candidate.packageName)||versionCode(candidate)!=code||!sameSignatures(current,candidate))throw new IOException("Signature ou identité de l’application invalide.");
            File directory=new File(getCacheDir(),"updates");if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Dossier de mise à jour inaccessible.");File ready=new File(directory,"anipic-update.apk");if(ready.exists()&&!ready.delete())throw new IOException("Ancienne mise à jour impossible à remplacer.");if(!partial.renameTo(ready))throw new IOException("Téléchargement impossible à finaliser.");verified=ready;
            ui("Téléchargement vérifié. Android va demander de confirmer l’installation. Les données de l’application seront conservées.");runOnUiThread(()->{action.setText("Installer la mise à jour");action.setEnabled(true);if(!isFinishing())install();});
        }catch(Exception e){partial.delete();ui(e.getMessage()==null?"Mise à jour impossible. Réessayez.":e.getMessage());runOnUiThread(()->{action.setText("Réessayer");action.setEnabled(true);});}
    });}
    private int signatureFlags(){return Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;}
    private long versionCode(PackageInfo p){return Build.VERSION.SDK_INT>=28?p.getLongVersionCode():p.versionCode;}
    private Signature[] signatures(PackageInfo p){return Build.VERSION.SDK_INT>=28?(p.signingInfo==null?new Signature[0]:p.signingInfo.getApkContentsSigners()):p.signatures;}
    private boolean sameSignatures(PackageInfo a,PackageInfo b){Signature[] x=signatures(a),y=signatures(b);if(x==null||y==null||x.length!=y.length||x.length==0)return false;java.util.HashSet<Signature> set=new java.util.HashSet<>(java.util.Arrays.asList(x));return set.equals(new java.util.HashSet<>(java.util.Arrays.asList(y)));}
    private String hex(byte[] bytes){StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return s.toString();}
    private void install(){
        if(verified==null||cancelled||isFinishing())return;
        if(Build.VERSION.SDK_INT>=26&&!getPackageManager().canRequestPackageInstalls()){waitingPermission=true;ui("Autorisez AniPic à installer ses mises à jour, puis revenez ici. Android demandera ensuite votre confirmation.");startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+getPackageName())));return;}
        try{Uri uri=FileProvider.getUriForFile(this,getPackageName()+".fileprovider",verified);Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(intent);ui("Confirmez dans la fenêtre Android. Si vous annulez, vous pourrez relancer l’installation ici.");}catch(Exception e){ui("Impossible d’ouvrir l’installateur Android. Utilisez la page /android du site.");}
    }
    @Override protected void onResume(){super.onResume();if(waitingPermission){waitingPermission=false;if(Build.VERSION.SDK_INT>=26&&getPackageManager().canRequestPackageInstalls())install();}}
    @Override protected void onDestroy(){cancelled=true;executor.shutdownNow();super.onDestroy();}
}
