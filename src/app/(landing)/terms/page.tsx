
// src/app/(landing)/terms/page.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <Card className="bg-card shadow-lg">
          <CardHeader>
            <CardTitle className="text-4xl font-bold text-foreground text-center">Hizmet Şartları</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-lg dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <p className="text-sm text-center">Son Güncelleme: {new Date().toLocaleDateString('tr-TR')}</p>
            
            <h2 className="text-2xl font-semibold text-foreground">1. Giriş</h2>
            <p>
              NeutralEdu AI ("Hizmet", "Uygulama") web uygulamasına hoş geldiniz. Bu Hizmet Şartları ("Şartlar"), web uygulamamızı kullanımınızı yönetir. 
              Hizmete erişerek veya kullanarak, bu Şartlara bağlı kalmayı kabul edersiniz.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">2. Hizmetin Kullanımı</h2>
            <p>
              NeutralEdu AI, kullanıcıların yapay zeka destekli özetleme için PDF belgeleri yüklemesine olanak tanır. Hizmeti yalnızca yasal amaçlarla ve bu Şartlara uygun olarak kullanmayı kabul edersiniz.
            </p>
            <p>
              Yüklediğiniz herhangi bir içerikten ve bu tür içeriği kullanma ve işleme hakkına sahip olduğunuzdan siz sorumlusunuz.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">3. Kullanıcı Hesapları ve Veriler</h2>
            <p>
              Belirli özelliklere erişmek için bir hesap açmanız gerekir. Hesap kimlik bilgilerinizin gizliliğini korumaktan siz sorumlusunuz.
            </p>
            <p>
              Yüklenen PDF'ler ve oluşturulan özetler dahil kullanıcı verileri, Gizlilik Politikamızda açıklandığı şekilde işlenir. PDF'ler yalnızca özet oluşturma amacıyla işlenir ve kullanıcı tarafından açıkça kaydedilmedikçe (özellik isteğe bağlı) uzun süreli saklanmaz.
            </p>
            <p>
              Kullanıcı profil bilgileri (UID, plan, kota, son özet tarihi, yönetici durumu) Firebase Firestore'da saklanır.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">4. Kotalar ve Planlar</h2>
            <p>
              Hizmet, değişen günlük özetleme kotalarına sahip farklı planlar (ör. Ücretsiz, Premium) sunar. Kotaları ve plan özelliklerini istediğimiz zaman değiştirme hakkımızı saklı tutarız.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">5. Fikri Mülkiyet</h2>
            <p>
              Hizmet ve orijinal içeriği (kullanıcı tarafından yüklenen içerik hariç), özellikleri ve işlevselliği NeutralEdu AI ve lisans verenlerinin münhasır mülkiyetindedir ve öyle kalacaktır.
            </p>
            <p>
              Yapay zeka tarafından oluşturulan özetler kişisel veya akademik kullanımınız içindir.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">6. Fesih</h2>
            <p>
              Hesabınızı feshedebilir veya Hizmete erişiminizi derhal, önceden bildirimde bulunmaksızın veya herhangi bir yükümlülük altına girmeksizin, tamamen kendi takdirimize bağlı olarak, Şartları ihlal etmeniz de dahil olmak üzere herhangi bir nedenle askıya alabiliriz.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">7. Sorumluluğun Sınırlandırılması</h2>
            <p>
              Hiçbir durumda NeutralEdu AI veya yöneticileri, çalışanları, ortakları, temsilcileri, tedarikçileri veya bağlı kuruluşları, Hizmete erişiminizden veya Hizmeti kullanımınızdan veya Hizmete erişememenizden veya kullanamamanızdan kaynaklanan kar, veri, kullanım, iyi niyet veya diğer maddi olmayan kayıplar dahil ancak bunlarla sınırlı olmamak üzere dolaylı, arızi, özel, sonuç olarak ortaya çıkan veya cezai zararlardan sorumlu tutulamaz.
            </p>
            
            <h2 className="text-2xl font-semibold text-foreground">8. Şartlarda Değişiklikler</h2>
            <p>
              Tamamen kendi takdirimize bağlı olarak, bu Şartları istediğimiz zaman değiştirme veya yenileme hakkımızı saklı tutarız. Herhangi bir değişikliği bu sayfada yeni Şartları yayınlayarak size bildireceğiz.
            </p>

            <h2 className="text-2xl font-semibold text-foreground">9. Bize Ulaşın</h2>
            <p>
              Bu Şartlar hakkında herhangi bir sorunuz varsa, lütfen ana sayfamızda verilen iletişim bilgileri aracılığıyla bizimle iletişime geçin.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
