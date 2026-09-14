package com.kinddevs.logiccoin;

import android.view.Gravity;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.yandex.mobile.ads.banner.BannerAdSize;
import com.yandex.mobile.ads.banner.BannerAdView;
import com.yandex.mobile.ads.common.AdRequest;
import com.yandex.mobile.ads.common.YandexAds;

/** A single banner per visible screen. Destroy the SDK view when React unmounts it. */
public final class YandexBannerManager extends SimpleViewManager<YandexBannerManager.Container> {
  @NonNull @Override public String getName() { return "LogicYandexBanner"; }
  @NonNull @Override protected Container createViewInstance(@NonNull ThemedReactContext context) {
    return new Container(context);
  }
  @ReactProp(name = "adUnitId") public void setAdUnitId(Container view, String id) {
    if (id == null || id.equals(view.unitId)) return;
    view.unitId = id;
    view.load();
  }
  @ReactProp(name = "adWidth", defaultInt = 320) public void setAdWidth(Container view, int width) {
    if (width == view.widthDp) return;
    view.widthDp = width;
    view.load();
  }
  @Override public void onDropViewInstance(@NonNull Container view) {
    view.disposed = true;
    view.generation++;
    view.clearAd();
    super.onDropViewInstance(view);
  }
  static final class Container extends FrameLayout {
    String unitId;
    int widthDp = 320;
    int generation;
    boolean disposed;
    BannerAdView banner;
    Container(ThemedReactContext context) { super(context); }
    void clearAd() {
      if (banner != null) { banner.destroy(); removeView(banner); banner = null; }
    }
    void load() {
      if (disposed || unitId == null || widthDp < 240) return;
      final int request = ++generation;
      clearAd();
      YandexAds.initialize(getContext().getApplicationContext(), () -> post(() -> {
        if (disposed || request != generation) return;
        banner = new BannerAdView(getContext());
        banner.setAdSize(BannerAdSize.inline(getContext(), widthDp, 60));
        addView(banner, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        banner.loadAd(new AdRequest.Builder(unitId).build());
      }));
    }
  }
}
