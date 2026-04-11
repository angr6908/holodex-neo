<template>
  <UiCard id="about" class-name="space-y-6 border-[color:var(--color-border)] p-6">
    <header>
      <h2 class="text-3xl font-semibold tracking-tight text-[color:var(--color-foreground)]">
        {{ t("component.mainNav.about") }}
      </h2>
    </header>

    <div class="grid gap-6">
      <UiCard class-name="overflow-hidden p-0">
        <TwitterFeed :key="'twtrTimeline' + timelinekey" :show-header="false" />
      </UiCard>
    </div>

    <UiCard class-name="p-6">
      <h3 class="text-lg font-semibold text-[color:var(--color-foreground)]">
        {{ t("about.credits.title") }}
      </h3>
      <div class="about-credits mt-4 space-y-4 text-sm leading-6 text-[color:var(--color-muted-foreground)]">
        <p>
          {{ t("about.credits.contents[0]") }}
          <a
            class="font-medium text-[color:var(--color-primary)] underline underline-offset-4 transition-opacity hover:opacity-90"
            href="https://hololive.jetri.co/"
          >HoloTools</a>
          {{ t("about.credits.contents[1]") }}
          <a
            class="font-medium text-[color:var(--color-primary)] underline underline-offset-4 transition-opacity hover:opacity-90"
            href="https://github.com/holofans/holoapi"
          >holoapi</a>.
          <br>
          {{ t("about.credits.contents[2]") }}
        </p>
        <p>
          {{ t("about.credits.contents[3]") }}
          <a
            class="font-medium text-[color:var(--color-primary)] underline underline-offset-4 transition-opacity hover:opacity-90"
            href="https://en.hololive.tv/terms"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t("about.credits.contents[4]") }}
          </a>
        </p>
        <p>
          By using this site you are agreeing to be bound by the
          <a
            class="font-medium text-[color:var(--color-primary)] underline underline-offset-4 transition-opacity hover:opacity-90"
            href="https://www.youtube.com/t/terms"
          >Youtube Terms of Service</a>.
        </p>
      </div>
    </UiCard>

    <div class="grid gap-6">
      <UiCard class-name="p-6">
        <h3 class="text-lg font-semibold text-[color:var(--color-foreground)]">
          {{ t("about.faq.title") }}
        </h3>
        <div class="mt-4 faq-list">
          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.faq.ytchatHeader") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content">
              {{ t("about.faq.ytchatContent") }}
              <br>
              <a
                class="text-sky-300 hover:text-sky-200"
                href="https://support.mozilla.org/en-US/kb/third-party-cookies-firefox-tracking-protection?redirectslug=disable-third-party-cookies"
              >
                {{ t("about.faq.ytchatFirefox") }}
              </a>
            </div>
          </details>

          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.faq.autoplayHeader") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content space-y-4">
              <p>{{ t("about.faq.autoplayContent") }}</p>
              <div class="space-y-4">
                <div>
                  <div class="mb-2 text-sm font-normal text-[color:var(--color-foreground)]">
                    Safari
                  </div>
                  <img
                    width="80%"
                    src="https://www.imore.com/sites/imore.com/files/styles/large/public/field/image/2017/07/safari-custom-settings-websites-mac-screenshot-06.jpg?itok=ONVYTcno"
                  >
                </div>
                <div>
                  <div class="mb-2 text-sm font-normal text-[color:var(--color-foreground)]">
                    Firefox
                  </div>
                  <img
                    width="80%"
                    src="https://ffp4g1ylyit3jdyti1hqcvtb-wpengine.netdna-ssl.com/firefox/files/2019/04/Screen-Shot-2019-04-01-at-11.21.21-AM.png"
                  >
                </div>
              </div>
            </div>
          </details>

          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.faq.mobile.title") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content">
              <p>{{ t("about.faq.mobile.content.summary") }}</p>
              <ul class="mt-3 space-y-2 pl-5">
                <li>
                  {{ t("about.faq.mobile.content.android.0") }}
                  <UiIcon :icon="mdiDotsVertical" size="sm" class-name="mx-1 text-sky-300" />
                  {{ t("about.faq.mobile.content.android.1") }}
                </li>
                <li>
                  {{ t("about.faq.mobile.content.ios.0") }}
                  <UiIcon :icon="mdiExportVariant" size="sm" class-name="mx-1 text-sky-300" />
                  {{ t("about.faq.mobile.content.ios[1]") }}
                </li>
              </ul>
            </div>
          </details>

          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.faq.favorite.disappear.title") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content">
              {{ t("about.faq.favorite.contents.0") }}
            </div>
          </details>

          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.faq.subber.title") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content">
              {{ t("about.faq.subber.contents.0") }}
              <a class="text-sky-300 hover:text-sky-200" href="https://forms.gle/xkN4w8fyPr6YTGfx6">
                {{ t("about.faq.subber.contents.1") }}
              </a>
              {{ t("about.faq.subber.contents.2") }}
            </div>
          </details>

          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.faq.videoLinkage") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content">
              {{ t("about.faq.videoLinkageContent") }}
            </div>
          </details>

          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.faq.quitHolodex") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content">
              {{ t("about.faq.quitHolodexContent") }}
            </div>
          </details>

          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.faq.feedback.title") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content">
              {{ t("about.faq.feedback.contents.0") }}
            </div>
          </details>

          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.faq.support.title") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content">
              <div v-html="t('about.faq.support.contents.0')" />
            </div>
          </details>

          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.privacyPolicy") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content space-y-4">
              <p>
                This Privacy Policy governs the manner in which Holodex collects, uses, maintains, and discloses information collected from users (each, a "User") of the Holodex website ("Site"). This privacy policy applies to the Site and all products and services offered by Holodex.
              </p>

              <div>
                <h4 class="text-base font-normal text-[color:var(--color-foreground)]">
                  Holodex First Party Information collection and usage:
                </h4>
                <p class="mt-2">
                  We collect limited personal identification information from Users in a variety of ways, including, but not limited to, when Users visit our Site, register on the Site, fill out a form, and in connection with other activities, services, features or resources we make available on our Site.
                </p>
                <p class="mt-2">
                  We will collect personal identification information from Users only if they voluntarily submit such information to us. Users can always refuse to supply personal identification information and use the Site without logging in.
                </p>
                <p class="mt-2">
                  i) Information Access: When you log in using your social media account, we will only access the basic information required to facilitate your login. This typically includes your email address or social media handle. We will not retrieve or store any other personal data from your social media account. We will also store the minimum amount of ID or email handle used to distinctly link a Holodex account with a Social Media Account so we may facilitate future logins.
                </p>
                <p class="mt-2">
                  ii) Limited Use: The information obtained from your social media account is solely for the purpose of allowing you to log into our service. We will not use this information for identification purposes outside of this function or share it with third parties without your explicit consent.
                </p>
                <p class="mt-2">
                  iii) No Posting: We will not post any content to your social media accounts on your behalf or access your contacts, friends, or followers.
                </p>
                <p class="mt-2">
                  iv) Revoking Access: You can revoke our access to your social media account at any time through your social media platform's settings. Revoking our access will not affect your account with us, but you may need to set up an alternative login method for our service.
                </p>
                <p class="mt-2">
                  Changes to This Clause: Any changes to our social media login policy will be updated on this page. We recommend that you periodically review this clause for any changes.
                </p>
              </div>

              <div>
                <h4 class="text-base font-normal text-white">
                  Third Party Information collection and usage:
                </h4>
                <h5 class="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-[color:var(--color-foreground)]">
                  1. Google Analytics
                </h5>
                <p class="mt-2">
                  We use Google Analytics, a service provided by Google, Inc., to analyze our website traffic. Google Analytics utilizes cookies to track visitor interactions and collects information about how visitors use our site. This data might include your IP address, browser type, browser version, the pages of our site that you visit, the time and date of your visit, the time spent on those pages, and other statistics.
                </p>
                <p class="mt-2">
                  The data collected is primarily used to report on website usage to help us understand our visitors' preferences and to enhance the user experience. Please refer to Google's privacy policy.
                </p>

                <h5 class="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-[color:var(--color-foreground)]">
                  2. YouTube & Twitch Embeds
                </h5>
                <p class="mt-2">
                  Our website may feature embedded videos from YouTube (owned by Google, Inc.) or Twitch (owned by Twitch Interactive, Inc.). When you watch these videos, these platforms may set cookies on your device and collect data such as your IP address, your browser type, and the page you visited on our site.
                </p>
                <p class="mt-2">
                  We've added links below to their respective privacy policies.
                </p>

                <h5 class="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-[color:var(--color-foreground)]">
                  Your Choices
                </h5>
                <p class="mt-2">
                  You can control and limit the data that third-party services collect by using the respective settings in your browser or device and by consulting the privacy settings specific to each third-party service.
                </p>

                <h5 class="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-[color:var(--color-foreground)]">
                  Contact Us about Privacy
                </h5>
                <p class="mt-2">
                  If you have concerns about the data these third parties collect or wish to find out more about your data protection rights, we encourage you to visit their respective privacy policies.
                </p>
                <p class="mt-2">
                  Your privacy is of paramount importance to us, and we are committed to ensuring the best standards are upheld. If you have any questions or concerns regarding our use of social media logins, please contact our team on discord.
                </p>
                <div class="space-y-2">
                  <a class="block text-sky-300 hover:text-sky-200" href="https://policies.google.com/privacy">Google and Youtube Privacy Policy</a>
                  <a class="block text-sky-300 hover:text-sky-200" href="https://www.twitch.tv/p/en/legal/privacy-notice/">Twitch Privacy Policy</a>
                </div>
              </div>
            </div>
          </details>

          <details class="faq-item">
            <summary class="faq-trigger">
              <span>{{ t("about.gdpr") }}</span>
              <UiIcon :icon="mdiChevronDown" size="sm" class-name="faq-chevron" />
            </summary>
            <div class="faq-content">
              {{ t("about.gdprContent") }}
              <span class="font-normal text-[color:var(--color-foreground)]">{{ t("about.gdprDeletion") }}</span>
            </div>
          </details>
        </div>
      </UiCard>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  mdiChevronDown,
  mdiExportVariant,
  mdiDotsVertical,
} from "@mdi/js";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import TwitterFeed from "@/components/common/TwitterFeed.vue";

const { t } = useI18n();
const timelinekey = ref(12);

// Note: `activated` hook is not available in `<script setup>`.
// If this component is used within <KeepAlive>, use onActivated:
import { onActivated } from "vue";
onActivated(() => {
  timelinekey.value += 1;
});
</script>

<style scoped>
.faq-list {
  display: grid;
  gap: 0.65rem;
}

.about-credits a {
  text-decoration: underline !important;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}

.faq-content :deep(a) {
  color: var(--color-primary);
  text-decoration: underline !important;
  text-underline-offset: 4px;
  text-decoration-thickness: 1px;
}

.faq-item {
  border: 1px solid var(--color-border);
  border-radius: calc(var(--radius) + 2px);
  background: color-mix(in srgb, var(--surface-soft) 90%, transparent);
  overflow: hidden;
  transition: border-color 160ms ease;
}

.faq-item:hover {
  border-color: var(--color-bold);
}

.faq-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  cursor: pointer;
  list-style: none;
  padding: 0.95rem 1rem;
  color: var(--color-foreground);
  font-size: 0.92rem;
  font-weight: 400;
  line-height: 1.35;
}

.faq-trigger::-webkit-details-marker {
  display: none;
}

.faq-chevron {
  flex-shrink: 0;
  color: var(--color-muted-foreground);
  transition: transform 180ms ease, color 180ms ease;
}

.faq-item[open] .faq-chevron {
  transform: rotate(180deg);
  color: var(--color-foreground);
}

.faq-content {
  border-top: 1px solid var(--color-border);
  padding: 0.85rem 1rem 1rem;
  color: var(--color-muted-foreground);
  line-height: 1.6;
}

</style>
