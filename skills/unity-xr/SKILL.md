# Unity VR/XR Development Guide for Meta Quest

This skill guides AI agents on how to configure, develop, optimize, and deploy Unity applications for Meta Quest (Quest 2, Quest 3, Quest Pro) using the XR Interaction Toolkit (XRI) and Meta XR SDK.

---

## 1. Project Configuration for Meta Quest

To configure a Unity project for standalone mobile VR on Quest:
- **Build Target**: Switch to **Android**.
- **Graphics API**: Use **Vulkan** for optimal GPU performance. Disable Auto Graphics API.
- **Color Space**: Use **Linear** color space (mandatory for modern mobile VR).
- **XR Plugin Management**: Enable **XR Plug-in Management** in Project Settings, and check **Oculus** (or OpenXR with Oculus Khronos extension) under both PC and Android tabs.
- **Rendering Mode**: Set to **Single Pass Instanced** to draw both eyes in a single draw call, cutting rendering overhead in half.

### Key Packages
Ensure the following package manifest dependencies are present:
- `com.unity.xr.interaction.toolkit`: Framework for handling grabs, teleports, and UI interactions.
- `com.unity.xr.oculus`: Oculus XR plugin provider.
- `com.meta.xr.sdk.core`: Oculus SDK core features (optional, for Meta-specific features like hand tracking, passthrough, spatial anchors).

---

## 2. VR/XR Performance Optimizations (Mobile VR)

Meta Quest is a mobile chip (Snapdragon XR2). Performance is critical to prevent motion sickness (target framerate: 72Hz, 90Hz, or 120Hz).
- **Draw Calls**: Keep draw calls (Batches) under **150-200** per frame. Use GPU Instancing and Static/Dynamic Batching.
- **Shaders**: Avoid heavy standard shaders. Use **URP (Universal Render Pipeline)** with **Universal Render Pipeline/Simple Lit** or specialized mobile shaders.
- **Physics**: Avoid complex mesh colliders. Use primitive colliders (Box, Sphere, Capsule) wherever possible.
- **Garbage Collection**: Keep frame allocations at zero. Avoid `Update` loop allocations.

---

## 3. Developing VR Mechanics with XR Interaction Toolkit (XRI)

### Setup XR Origin
A standard VR player rig uses `XR Origin (Action-based)`:
- Main Camera (with `Tracked Pose Driver`).
- Left Controller / Right Controller (with `XR Controller (Action-based)` and model loaders).
- `Locomotion System` handling `Teleportation Provider` or `Continuous Move Provider`.

### Scripting Grabs & Hands
Use XRI components for interactions:
- **Interactable**: Add `XR Grab Interactable` to object you want the player to pick up.
- **Interactor**: Add `XR Direct Interactor` (for direct touch grabbing) or `XR Ray Interactor` (for laser pointer distant grabbing) to player hands.

```csharp
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;

[RequireComponent(typeof(XRGrabInteractable))]
public class VRWeapon : MonoBehaviour
{
    private XRGrabInteractable _grabInteractable;

    private void Awake()
    {
        _grabInteractable = GetComponent<XRGrabInteractable>();
    }

    private void OnEnable()
    {
        _grabInteractable.activated.AddListener(OnTriggerPressed);
    }

    private void OnDisable()
    {
        _grabInteractable.activated.RemoveListener(OnTriggerPressed);
    }

    private void OnTriggerPressed(ActivateEventArgs args)
    {
        // Trigger pressed while holding the weapon
        FireWeapon();
    }

    private void FireWeapon()
    {
        Debug.Log("[VRWeapon] Weapon fired!");
    }
}
```

---

## 4. ADB Deployment Commands (Oculus Quest)

To deploy builds directly to a Quest headset, use Android Debug Bridge (ADB):
- **Detect Headset**: `adb devices`
- **Install APK**: `adb install -r Builds/Android/Game.apk`
- **Run Application**: `adb shell am start -n <PackageName>/com.unity3d.player.UnityPlayerActivity`
- **Stream Quest Console**: `adb logcat -s Unity`
- **Capture Headset Screen**: `adb shell screencap -p /sdcard/vr_shot.png && adb pull /sdcard/vr_shot.png`
