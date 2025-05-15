// src/app/(landing)/privacy/page.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <Card className="bg-card shadow-lg">
          <CardHeader>
            <CardTitle className="text-4xl font-bold text-foreground text-center">Gizlilik Politikası</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-lg dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <p className="text-sm text-center">Son Güncelleme: {new Date().toLocaleDateString('tr-TR')}</p>

            <h2 className="text-2xl font-semibold text-foreground">1. Giriş</h2>
            <p>
              NeutralEdu AI ("biz", "bize", "bizim") gizliliğinizi korumayı taahhüt eder. Bu Gizlilik Politikası, web uygulamamızı kullandığınızda bilgilerinizi nasıl topladığımızı, kullandığımızı, ifşa ettiğimizi ve koruduğumuzu açıklar.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">2. Topladığımız Bilgiler</h2>
            <p>Aşağıdaki türde bilgileri toplayabiliriz:</p>
            <ul className="list-disc pl-6">
              <li>
                <strong>Kişisel Kimlik Bilgileri:</strong> Kayıt olduğunuzda e-posta adresinizi toplarız. UID'niz, plan türünüz, günlük kotanız, son işlem tarihiniz ve yönetici durumunuz Firebase Firestore'da saklanır.
              </li>
              <li>
                <strong>Yüklenen Belgeler ve Girilen Metinler:</strong> Bir PDF yüklediğinizde veya metin girdiğinizde, içerik çıkarılır ve yapay zeka işlemesi için üçüncü parti API'lere (örn: Google Gemini) gönderilir. Kullanıcı tarafından sağlanan içerikleri yalnızca istenen AI işlemini gerçekleştirmek amacıyla işleriz. Bu belgeler veya metinler, açık bir "kaydet" özelliği kullanmadığınız sürece (varsa) varsayılan olarak uzun süreli saklanmaz.
              </li>
              <li>
                <strong>Oluşturulan AI İçerikleri:</strong> Yapay zeka tarafından oluşturulan özetler, çözümler, testler vb. size gösterilir. Üçüncü taraflarla paylaşılmazlar. Bir "kaydet" özelliği kullanılırsa, hesabınızla ilişkili Firebase Storage'da veya Firestore'da saklanabilirler.
              </li>
              <li>
                <strong>Kullanım Günlükleri:</strong> Analitik, kota takibi ve hizmet iyileştirme için kullanım günlüklerini (ör. kullanıcı kimliği, işlem zaman damgası, potansiyel olarak işlenen karakter sayısı) saklarız. Bu günlükler Firebase Firestore'da saklanır.
              </li>
            </ul>

            <h2 className="text-2xl font-semibold text-foreground">3. Bilgilerinizi Nasıl Kullanıyoruz</h2>
            <p>Topladığımız bilgileri şu amaçlarla kullanırız:</p>
            <ul className="list-disc pl-6">
              <li>Hizmetimizi sağlamak, işletmek ve sürdürmek.</li>
              <li>Hesabınızı yönetmek ve müşteri desteği sağlamak.</li>
              <li>PDF yüklemelerinizi veya metin girdilerinizi işlemek ve AI tabanlı içerikler oluşturmak.</li>
              <li>Günlük kotanızı izlemek ve uygulamak.</li>
              <li>Hizmetimizi geliştirmek ve yeni özellikler geliştirmek.</li>
              <li>Analitik ve güvenlik amacıyla kullanımı izlemek.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-foreground">4. Veri Depolama ve Güvenlik</h2>
            <p>
              Kullanıcı profil bilgileriniz, kullanım günlükleriniz ve isteğe bağlı olarak kaydedilen AI içerikleri, güçlü güvenlik önlemleri sağlayan Firebase (Firestore ve Storage) üzerinde saklanır.
            </p>
            <p>
              Kişisel Bilgilerinizi korumak için ticari olarak kabul edilebilir yöntemler kullanmaya çalışsak da, İnternet üzerinden hiçbir iletim yöntemi veya elektronik depolama yöntemi %100 güvenli değildir.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">5. Veri Paylaşımı ve İfşası</h2>
            <p>
              Kişisel olarak tanımlanabilir bilgilerinizi dış taraflara satmayız, takas etmeyiz veya başka bir şekilde aktarmayız.
            </p>
            <p>
              Yüklenen PDF içeriği veya girilen metinler, işlenmek üzere Google Gemini gibi üçüncü parti yapay zeka API'lerine gönderilir. Bu API sağlayıcılarının verilerinizi nasıl kullandığı, kendi gizlilik politikaları ve hizmet şartlarına tabidir.
            </p>
            <p>
              Yasalarca zorunlu kılınırsa veya kamu makamlarının geçerli taleplerine yanıt olarak bilgilerinizi ifşa edebiliriz.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">6. Veri Haklarınız</h2>
            <p>
              Yerel veri koruma yasalarına tabi olarak kişisel verilerinizle ilgili belirli haklara sahip olabilirsiniz. Bunlar, kişisel verilerinize erişme, bunları düzeltme veya silme hakkını içerebilir. Bu hakları kullanmak için lütfen bizimle iletişime geçin.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">7. Çocukların Gizliliği</h2>
            <p>
              Hizmetimiz 13 yaşın altındaki çocuklar (veya yerel yasalarca daha yüksek bir yaş eşiği belirtilmişse) tarafından kullanılmak üzere tasarlanmamıştır. Çocuklardan bilerek kişisel olarak tanımlanabilir bilgi toplamıyoruz.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">8. Bu Gizlilik Politikasındaki Değişiklikler</h2>
            <p>
              Gizlilik Politikamızı zaman zaman güncelleyebiliriz. Herhangi bir değişikliği bu sayfada yeni Gizlilik Politikasını yayınlayarak size bildireceğiz.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">9. Bize Ulaşın</h2>
            <p>
              Bu Gizlilik Politikası hakkında herhangi bir sorunuz varsa, lütfen ana sayfamızda verilen iletişim bilgileri aracılığıyla bizimle iletişime geçin.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
