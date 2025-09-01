// add-post.js - الإصدار المصحح
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
    checkAuthState();
    setupEventListeners();
});

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // اختيار صورة من المعرض
    chooseImageBtn.addEventListener('click', () => {
        postImageInput.removeAttribute('capture');
        postImageInput.click();
    });

    // فتح الكاميرا
    cameraBtn.addEventListener('click', () => {
        postImageInput.setAttribute('capture', 'environment');
        postImageInput.click();
    });

    // عرض معاينة الصورة
    postImageInput.addEventListener('change', handleImageSelect);

    // إزالة الصورة المختارة
    removeImageBtn.addEventListener('click', removeSelectedImage);

    // نشر منشور جديد
    addPostForm.addEventListener('submit', handlePublishPost);
}

// التحقق من حالة المصادقة
function checkAuthState() {
    onAuthStateChanged(auth, user => {
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }
        
        // تحميل بيانات المستخدم الحالي
        const userRef = ref(database, 'users/' + user.uid);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                currentUserData = snapshot.val();
                currentUserData.uid = user.uid;
                
                if (currentUserData.isAdmin) {
                    adminIcon.style.display = 'flex';
                }
            }
        }, { onlyOnce: true });
    });
}

// معالجة اختيار الصورة
function handleImageSelect() {
    if (this.files && this.files[0]) {
        selectedFile = this.files[0];
        imageName.textContent = selectedFile.name;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            imagePreview.classList.remove('hidden');
        }
        reader.readAsDataURL(selectedFile);
    }
}

// إزالة الصورة المختارة
function removeSelectedImage() {
    postImageInput.value = '';
    selectedFile = null;
    imageName.textContent = 'لم يتم اختيار صورة';
    imagePreview.classList.add('hidden');
}

// معالجة نشر المنشور
async function handlePublishPost(e) {
    e.preventDefault();
    
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
                imageUrl = await uploadImage(selectedFile, user.uid);
            } catch (uploadError) {
                console.error('Error uploading image:', uploadError);
                // الاستمرار في حفظ المنشور حتى بدون صورة إذا فشل الرفع
                alert('تم حفظ المنشور ولكن حدث خطأ في رفع الصورة. يرجى المحاولة مرة أخرى لاحقًا.');
            }
        }
        
        // حفظ بيانات المنشور في قاعدة البيانات
        const postData = {
            title: title,
            description: description,
            price: price || 'غير محدد',
            location: location || 'غير محدد',
            phone: phone || 'غير متاح',
            imageUrl: imageUrl,
            authorId: user.uid,
            authorName: currentUserData.name || 'مستخدم',
            createdAt: Date.now(), // استخدام التاريخ كرقم للتسهيل
            timestamp: serverTimestamp() // وحفظ الطابع الزمني لـ Firebase
        };
        
        const postsRef = ref(database, 'posts');
        const newPostRef = push(postsRef);
        await set(newPostRef, postData);
        
        alert('تم نشر المنشور بنجاح!');
        resetForm();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error publishing post:', error);
        alert('حدث خطأ أثناء نشر المنشور. يرجى المحاولة مرة أخرى.');
    } finally {
        hideLoading();
    }
}

// رفع الصورة إلى التخزين
async function uploadImage(file, userId) {
    return new Promise((resolve, reject) => {
        // إضافة طابع زمني لاسم الملف لمنع التكرار
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const fileName = `post_${timestamp}.${fileExtension}`;
        
        const storagePath = `posts/${userId}/${fileName}`;
        const imageRef = storageRef(storage, storagePath);
        
        // تحديد نوع MIME للصورة
        const metadata = {
            contentType: file.type
        };
        
        const uploadTask = uploadBytesResumable(imageRef, file, metadata);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                uploadProgress.style.width = progress + '%';
            },
            (error) => {
                console.error('Upload error:', error);
                reject(error);
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(downloadURL);
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}

// إعادة تعيين النموذج
function resetForm() {
    addPostForm.reset();
    postImageInput.value = '';
    selectedFile = null;
    imageName.textContent = 'لم يتم اختيار صورة';
    imagePreview.classList.add('hidden');
}

// وظائف مساعدة
function showLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        uploadProgress.style.width = '0%';
    }
  }
