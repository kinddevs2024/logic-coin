package com.kinddevs.logiccoin;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.yandex.mobile.ads.common.AdError;
import com.yandex.mobile.ads.common.AdRequest;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.InitializationListener;
import com.yandex.mobile.ads.common.YandexAds;
import com.yandex.mobile.ads.rewarded.Reward;
import com.yandex.mobile.ads.rewarded.RewardedAd;
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoader;

import java.util.UUID;

public final class YandexAdsModule extends ReactContextBaseJavaModule {
  private static final String TAG = "YandexAds";
  private static final String EVENT = "YandexAdsRewardedEvent";

  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private boolean initialized = false;
  private boolean loading = false;
  private boolean showing = false;
  private boolean rewardEarned = false;
  private int rewardAmount = 0;
  private String rewardCurrency = "";
  private String adUnitId = "";
  private RewardedAdLoader rewardedAdLoader;
  private RewardedAd rewardedAd;
  private Promise showPromise;
  private String showProof = "";

  public YandexAdsModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return "YandexAds";
  }

  @ReactMethod
  public void initialize(String requestedAdUnitId, boolean enableLogging, Promise promise) {
    mainHandler.post(() -> {
      if (requestedAdUnitId == null || requestedAdUnitId.trim().isEmpty()) {
        promise.reject("invalid_ad_unit", "Yandex rewarded ad unit ID is empty");
        return;
      }
      adUnitId = requestedAdUnitId.trim();
      if (initialized) {
        promise.resolve(true);
        loadRewardedInternal();
        return;
      }
      try {
        YandexAds.enableLogging(enableLogging);
        YandexAds.initialize(getReactApplicationContext().getApplicationContext(),
          new InitializationListener() {
            @Override
            public void onInitializationCompleted() {
              initialized = true;
              Log.d(TAG, "Yandex Ads SDK initialized");
              emit("initialized", null);
              loadRewardedInternal();
              promise.resolve(true);
            }
          });
      } catch (Exception error) {
        Log.e(TAG, "Yandex Ads SDK initialization failed", error);
        promise.reject("initialization_failed", error.getMessage(), error);
      }
    });
  }

  @ReactMethod
  public void loadRewarded(Promise promise) {
    mainHandler.post(() -> {
      if (!initialized) {
        promise.resolve(false);
        return;
      }
      loadRewardedInternal();
      promise.resolve(true);
    });
  }

  @ReactMethod
  public void isRewardedLoaded(Promise promise) {
    mainHandler.post(() -> promise.resolve(rewardedAd != null && !showing));
  }

  @ReactMethod
  public void showRewarded(Promise promise) {
    mainHandler.post(() -> {
      if (showing) {
        promise.reject("already_showing", "A Yandex rewarded ad is already showing");
        return;
      }
      if (rewardedAd == null) {
        promise.reject("not_ready", "Yandex rewarded ad is not loaded");
        return;
      }
      Activity activity = getCurrentActivity();
      if (activity == null) {
        promise.reject("no_activity", "No foreground activity is available for Yandex rewarded ad");
        return;
      }
      showing = true;
      rewardEarned = false;
      rewardAmount = 0;
      rewardCurrency = "";
      showProof = "yandex-" + UUID.randomUUID();
      showPromise = promise;
      rewardedAd.setAdEventListener(new RewardedAdEventListener() {
        @Override
        public void onAdShown() {
          Log.d(TAG, "Rewarded ad shown");
          emit("shown", null);
        }

        @Override
        public void onAdFailedToShow(@NonNull AdError adError) {
          String message = adError.getDescription();
          Log.e(TAG, "Rewarded ad failed: " + message);
          emitError("failed_to_show", message);
          finishShow(false, "failed", message);
        }

        @Override
        public void onAdDismissed() {
          Log.d(TAG, "Rewarded ad closed");
          emit("closed", null);
          finishShow(rewardEarned, rewardEarned ? "" : "dismissed", "");
        }

        @Override
        public void onAdClicked() {
        }

        @Override
        public void onAdImpression(@Nullable com.yandex.mobile.ads.common.ImpressionData impressionData) {
        }

        @Override
        public void onRewarded(@NonNull Reward reward) {
          if (rewardEarned) return;
          rewardEarned = true;
          rewardAmount = reward.getAmount();
          rewardCurrency = reward.getType();
          Log.d(TAG, "Reward earned");
          WritableMap payload = Arguments.createMap();
          payload.putInt("amount", rewardAmount);
          payload.putString("currency", rewardCurrency);
          emit("reward", payload);
        }
      });
      rewardedAd.show(activity);
    });
  }

  private void loadRewardedInternal() {
    if (!initialized || loading || rewardedAd != null || adUnitId.isEmpty()) return;
    if (rewardedAdLoader == null) {
      rewardedAdLoader = new RewardedAdLoader(getReactApplicationContext().getApplicationContext());
    }
    loading = true;
    Log.d(TAG, "Rewarded ad loading");
    emit("loading", null);
    try {
      rewardedAdLoader.loadAd(new AdRequest.Builder(adUnitId).build(), new RewardedAdLoadListener() {
        @Override
        public void onAdLoaded(@NonNull RewardedAd ad) {
          loading = false;
          rewardedAd = ad;
          Log.d(TAG, "Rewarded ad loaded");
          emit("loaded", null);
        }

        @Override
        public void onAdFailedToLoad(@NonNull AdRequestError error) {
          loading = false;
          String message = error.getDescription();
          Log.e(TAG, "Rewarded ad failed: " + message);
          emitError("failed", message);
        }
      });
    } catch (Exception error) {
      loading = false;
      Log.e(TAG, "Rewarded ad failed", error);
      emitError("failed", error.getMessage());
    }
  }

  private void finishShow(boolean completed, String reason, String error) {
    Promise promise = showPromise;
    showPromise = null;
    showing = false;
    if (rewardedAd != null) rewardedAd.setAdEventListener(null);
    rewardedAd = null;
    if (promise != null) {
      WritableMap result = Arguments.createMap();
      result.putBoolean("completed", completed);
      result.putString("proof", completed ? showProof : "");
      result.putInt("amount", rewardAmount);
      result.putString("currency", rewardCurrency);
      if (!reason.isEmpty()) result.putString("reason", reason);
      if (!error.isEmpty()) result.putString("error", error);
      promise.resolve(result);
    }
    loadRewardedInternal();
  }

  private void emit(String type, @Nullable WritableMap payload) {
    if (!getReactApplicationContext().hasActiveCatalystInstance()) return;
    if (payload == null) payload = Arguments.createMap();
    payload.putString("type", type);
    getReactApplicationContext()
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(EVENT, payload);
  }

  private void emitError(String type, @Nullable String message) {
    WritableMap payload = Arguments.createMap();
    payload.putString("error", message == null ? "Unknown error" : message);
    emit(type, payload);
  }
}
