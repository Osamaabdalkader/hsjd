// add-post.js - الإصدار المحسن مع تسجيل الأخطاء
import { 
  auth, database, storage, serverTimestamp,
  ref, set, push, storageRef, uploadBytesResumable, getDownloadURL,
  onAuthStateChanged
} from './firebase.js';

// عناصر DOM
const addPostForm = document.getElementById('add-post-form');
const postImageInput = document.getElementById('post-image');
const chooseImageBtn = document.getElementById('choose-image-btn');
const cameraBtn = document.getElementById('camera-btn');
const imageName = document.getElementById('image-name');
const imagePreview = document.getElementById('image-preview');
const previewImg = document.getElementById('preview-img');
const removeImageBtn = document.getElementById('remove-image-btn');
const publishBtn = document.getElementById('publish-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const uploadProgress = document.getElementById('upload-progress');
const adminIcon = document.getElementById('admin-icon');

// متغيرات النظام
let currentUserData = null;
let selectedFile = null;

// تحميل بيانات المستخدم عند بدء التحميل
document.addEventListener('DOMContentLoaded', () => {
    console.log('صفحة إضافة منشور تم تحميلها');
    checkAuthState();
    setupEventListeners();
});

// إعداد مستمعي الأحداث
function setupEventListeners() {
    console.log('جاري إعداد مستمعي الأحداث');
    
    // اختيار صورة من المعرض
    chooseImageBtn.addEventListener('click', () => {
        console.log('نقر على اختيار صورة');
        postImageInput.removeAttribute('capture');
        postImageInput.click();
    });

    // فتح الكاميرا
    cameraBtn.addEventListener('click', () => {
        console.log('نقر على فتح الكاميرا');
        postImageInput.setAttribute('capture', 'environment');
        postImageInput.click();
    });

    // عرض معاينة الصورة
    postImageInput.addEventListener('change', handleImageSelect);

    // إزالة الصورة المختارة
    removeImageBtn.addEventListener('click', removeSelectedImage);

    // نشر منشور جديد
    addPostForm.addEventListener('submit', handlePublishPost);
    
    console.log('تم إعداد مستمعي الأحداث بنجاح');
}

// التحقق من حالة المصادقة
function checkAuthState() {
    console.log('التحقق من حالة المصادقة...');
    
    onAuthStateChanged(auth, user => {
        if (!user) {
            console.log('المستخدم غير مسجل، التوجيه إلى صفحة التسجيل');
            window.location.href = 'auth.html';
            return;
        }
        
        console.log('المستخدم مسجل، جاري تحميل البيانات:', user.uid);
        
        // تحميل بيانات المستخدم الحالي
        const userRef = ref(database, 'users/' + user.uid);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                currentUserData = snapshot.val();
                currentUserData.uid = user.uid;
                console.log('تم تحميل بيانات المستخدم:', currentUserData);
                
                if (currentUserData.isAdmin) {
                    adminIcon.style.display = 'flex';
                    console.log('المستخدم هو مشرف');
                }
            } else {
                console.log('لا توجد بيانات للمستخدم');
            }
        }, { onlyOnce: true });
    });
}

// معالجة اختيار الصورة
function handleImageSelect() {
    console.log('تم اختيار صورة');
    
    if (this.files && this.files[0]) {
        selectedFile = this.files[0];
        imageName.textContent = selectedFile.name;
        console.log('اسم الملف:', selectedFile.name, 'نوع الملف:', selectedFile.type, 'حجم الملف:', selectedFile.size);
        
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            imagePreview.classList.remove('hidden');
            console.log('تم تحميل معاينة الصورة');
        }
        reader.readAsDataURL(selectedFile);
    }
}

// إزالة الصورة المختارة
function removeSelectedImage() {
    console.log('إزالة الصورة المختارة');
    postImageInput.value = '';
    selectedFile = null;
    imageName.textContent = 'لم يتم اختيار صورة';
    imagePreview.classList.add('hidden');
}

// معالجة نشر المنشور
async function handlePublishPost(e) {
    e.preventDefault();
    console.log('بدء عملية نشر المنشور');
    
    const user = auth.currentUser;
    if (!user) {
        alert('يجب تسجيل الدخول أولاً');
        window.location.href = 'auth.html';
        return;
    }
    
    const title = document.getElementById('post-title').value.trim();
    const description = document.getElementById('post-description').value.trim();
    const price = document.getElementById('post-price').value.trim();
    const location = document.getElementById('post-location').value.trim();
    const phone = document.getElementById('post-phone').value.trim();
    
    console.log('بيانات النموذج:', { title, description, price, location, phone });
    
    if (!title || !description) {
        alert('يرجى ملء العنوان والوصف');
        return;
    }
    
    showLoading();
    
    try {
        let imageUrl = '';
        
        // رفع الصورة إذا تم اختيارها
        if (selectedFile) {
            try {
                console.log('بدء رفع الصورة...');
                imageUrl = await uploadImage(selectedFile, user.uid);
                console.log('تم رفع الصورة بنجاح، الرابط:', imageUrl);
            } catch (uploadError) {
                console.error('خطأ في رفع الصورة:', uploadError);
                // الاستمرار في حفظ المنشور حتى بدون صورة إذا فشل الرفع
                alert('تم حفظ المنشور ولكن حدث خطأ في رفع الصورة. يرجى المحاولة مرة أخرى لاحقًا.');
            }
        }
        
        // حفظ بيانات المنشور في قاعدة البيانات
        console.log('بدء حفظ بيانات المنشور في قاعدة البيانات...');
        
        const postData = {
            title: title,
            description: description,
            price: price || 'غير محدد',
            location: location || 'غير محدد',
            phone: phone || 'غير متاح',
            imageUrl: imageUrl,
            authorId: user.uid,
            authorName: currentUserData.name || 'مستخدم',
            createdAt: Date.now(),
            timestamp: serverTimestamp()
        };
        
        console.log('بيانات المنشور التي سيتم حفظها:', postData);
        
        const postsRef = ref(database, 'posts');
        const newPostRef = push(postsRef);
        await set(newPostRef, postData);
        
        console.log('تم نشر المنشور بنجاح في قاعدة البيانات');
        alert('تم نشر المنشور بنجاح!');
        resetForm();
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('خطأ تفصيلي أثناء نشر المنشور:', error);
        console.error('رسالة الخطأ:', error.message);
        console.error('اسم الخطأ:', error.name);
        console.error('مكدس الاستدعاء:', error.stack);
        
        alert('حدث خطأ أثناء نشر المنشور. يرجى فتح أدوات المطور (F12) ومراجعة وحدة التحكم للتفاصيل.');
    } finally {
        hideLoading();
    }
}

// رفع الصورة إلى التخزين
async function uploadImage(file, userId) {
    return new Promise((resolve, reject) => {
        console.log('بدء عملية رفع الصورة إلى التخزين...');
        
        // إضافة طابع زمني لاسم الملف لمنع التكرار
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `post_${timestamp}.${fileExtension}`;
        
        const storagePath = `posts/${userId}/${fileName}`;
        const imageRef = storageRef(storage, storagePath);
        
        console.log('مسار التخزين:', storagePath);
        
        // تحديد نوع MIME للصورة
        const metadata = {
            contentType: file.type
        };
        
        const uploadTask = uploadBytesResumable(imageRef, file, metadata);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                uploadProgress.style.width = progress + '%';
                console.log(`تم رفع ${progress}% من الصورة`);
            },
            (error) => {
                console.error('خطأ أثناء الرفع:', error);
                console.error('كود الخطأ:', error.code);
                console.error('رسالة الخطأ:', error.message);
                reject(error);
            },
            async () => {
                try {
                    console.log('تم الانتهاء من الرفع، جاري الحصول على رابط التحميل...');
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    console.log('تم الحصول على رابط التحميل:', downloadURL);
                    resolve(downloadURL);
                } catch (error) {
                    console.error('خطأ في الحصول على رابط التحميل:', error);
                    reject(error);
                }
            }
        );
    });
}

// إعادة تعيين النموذج
function resetForm() {
    console.log('إعادة تعيين النموذج');
    addPostForm.reset();
    postImageInput.value = '';
    selectedFile = null;
    imageName.textContent = 'لم يتم اختيار صورة';
    imagePreview.classList.add('hidden');
}

// وظائف مساعدة
function showLoading() {
    console.log('عرض شاشة التحميل');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    console.log('إخفاء شاشة التحميل');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        uploadProgress.style.width = '0%';
    }
}
