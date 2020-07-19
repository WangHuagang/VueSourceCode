
### MVVM原理

代码地址：[https://github.com/WangHuagang/VueSourceCode](https://github.com/WangHuagang/VueSourceCode)

Vue响应式原理最核心的方法便是通过Object.defineProperty()来实现对属性的劫持，达到监听数据变动的目的，无疑这个方法是本文中最重要、最基础的内容之一
整理了一下，要实现mvvm的双向绑定，就必须要实现以下几点：

1、实现一个数据监听器Observer，能够对数据对象的所有属性进行监听，如有变动可拿到最新值并通知订阅者
2、实现一个指令解析器Compile，对每个元素节点的指令进行扫描和解析，根据指令模板替换数据，以及绑定相应的更新函数
3、实现一个Watcher，作为连接Observer和Compile的桥梁，能够订阅并收到每个属性变动的通知，执行指令绑定的相应回调函数，从而更新视图
4、mvvm入口函数，整合以上三者

![](https://user-gold-cdn.xitu.io/2020/6/9/172970655167cff7?imageView2/0/w/1280/h/960/format/webp/ignore-error/1)

通过这张图的分析，主要包含以下三个类：
- 指令解析器Compile
- 数据监听器Observe
- 观察者Watcher

### 实现指令解析器Compile

实现一个指令解析器Compile，对每个元素节点的指令进行扫描和解析，根据指令模板替换数据，以及绑定相应的更新函数,添加监听数据的订阅者，一旦数据有变动，收到通知，更新视图.

#### 初始化，新建WVue.js
```
class WVue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        //保存 options参数,后面处理数据要用到
        this.$options = options;
        // 如果这个根元素存在则开始编译模板
        if (this.$el) {
            // 1.实现一个指令解析器compile
            new Compile(this.$el, this)
        }
    }
}
class Compile{
    constructor(el,vm) {
        // 判断el参数是否是一个元素节点,如果是直接赋值,如果不是 则获取赋值
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
    }
    isElementNode(node){
        // 判断是否是元素节点
        return node.nodeType === 1
    }
}
```
#### 优化编译使用碎片
```
 <h3>姓名：{{obj.name}}</h3>
        <h3>年龄：{{obj.age}}</h3>
        <div v-html='html'></div>
        <div>{{msg}}</div>
        <input type="text" v-model='msg'>
        <button @click='update'>更新</button>
```
接下来,找到子元素的值,比如obj.name,obj.age,获取数据中的值替换掉;
但是在这里我们不得不想到一个问题,每次找到一个数据替换,都要重新渲染一遍,可能会造成页面的回流和重绘,那么我们最好的办法就是把以上的元素放在内存中,在内存中操作完成之后,再替换掉.
```
class Compile {
    constructor(el, vm) {
        // 判断el参数是否是一个元素节点,如果是直接赋值,如果不是 则获取赋值
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
        // 因为每次匹配到进行替换时,会导致页面的回流和重绘,影响页面的性能
        // 所以需要创建文档碎片来进行缓存,减少页面的回流和重绘
        // 1.获取文档碎片对象
        const fragment = this.node2Fragment(this.el);
        // console.log(fragment);
        // 2.编译模板
        // 3.把子元素的所有内容添加到根元素中
        this.el.appendChild(fragment);

    }
    node2Fragment(el) {
        const fragment = document.createDocumentFragment();
        let firstChild;
        while (firstChild = el.firstChild) {
            fragment.appendChild(firstChild);
        }
        return fragment
    }
    isElementNode(el) {
        return el.nodeType === 1;
    }
}

```
这样经过碎片文档处理一下，极大的优化了页面渲染性能。
#### 编译模板
```
// 编译数据的类
class Compile {
    constructor(el, vm) {
        // 判断el参数是否是一个元素节点,如果是直接赋值,如果不是 则获取赋值
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
        // 因为每次匹配到进行替换时,会导致页面的回流和重绘,影响页面的性能
        // 所以需要创建文档碎片来进行缓存,减少页面的回流和重绘
        // 1.获取文档碎片对象
        const fragment = this.node2Fragment(this.el);
        // console.log(fragment);
        // 2.编译模板
        this.compile(fragment)

        // 3.把子元素的所有内容添加到根元素中
        this.el.appendChild(fragment);

    }
    compile(fragment) {
        // 1.获取子节点
        const childNodes = fragment.childNodes;
        // 2.遍历子节点
        [...childNodes].forEach(child => {

            // 3.对子节点的类型进行不同的处理
            if (this.isElementNode(child)) {
                // 是元素节点
                // 编译元素节点
                // console.log('我是元素节点',child);
                this.compileElement(child);
            } else {
                // console.log('我是文本节点',child);
                this.compileText(child);
                // 剩下的就是文本节点
                // 编译文本节点
            }
            // 4.一定要记得,递归遍历子元素
            if (child.childNodes && child.childNodes.length) {
                this.compile(child);
            }
        })
    }
    // 编译文本的方法
    compileText(node) {
        console.log('编译文本')

    }
    node2Fragment(el) {
        const fragment = document.createDocumentFragment();
        // console.log(el.firstChild);
        let firstChild;
        while (firstChild = el.firstChild) {
            fragment.appendChild(firstChild);
        }
        return fragment
    }
    isElementNode(el) {
        return el.nodeType === 1;
    }
}

```
然后我们需要根据不同的子元素的类型进行不同的渲染
#### 编译元素
```
compileElement(node) {
    // 获取该节点的所有属性
    const attributes = node.attributes;
    // 对属性进行遍历
    [...attributes].forEach(attr => {
        const { name, value } = attr; //v-text v-model   v-on:click  @click 
        // 看当前name是否是一个指令
        if (this.isDirective(name)) {
            //对v-text进行操作
            const [, directive] = name.split('-'); //text model html
            // v-bind:src
            const [dirName, eventName] = directive.split(':'); //对v-on:click 进行处理
            // 更新数据
            compileUtil[dirName] && compileUtil[dirName](node, value, this.vm, eventName);
            // 移除当前元素中的属性
            node.removeAttribute('v-' + directive);

        }else if(this.isEventName(name)){
            // 对事件进行处理 在这里处理的是@click
            let [,eventName] =  name.split('@');
            compileUtil['on'](node, value, this.vm, eventName)
        }

    })

}
// 是否是@click这样事件名字
isEventName(attrName){
    return attrName.startsWith('@')
}
//判断是否是一个指令
isDirective(attrName) {
    return attrName.startsWith('v-')
}

```
#### 编译文本
```
/ /编译文本的方法
compileText(node) {
    const content = node.textContent;
    // 匹配{{xxx}}的内容
    if (/\{\{(.+?)\}\}/.test(content)) {
        // 处理文本节点
        compileUtil['text'](node, content, this.vm)
    }

}

```
compileUtil这个对象它是什么鬼?真正的编译操作我将它放入到这个对象中,根据不同的指令来做不同的处理.比如v-text是处理文本的 v-html是处理html元素 v-model是处理表单数据的.....
这样我们在当前对象compileUtil中通过updater函数来初始化视图;
整合一下：
```
const compileUtil = {
    // 获取值的方法
    getVal(expr, vm) {
        return expr.split('.').reduce((data, currentVal) => {
            return data[currentVal]
        }, vm.$data)
    },
    getAttrs(expr,vm){

    },
    text(node, expr, vm) { //expr 可能是 {{obj.name}}--{{obj.age}} 
        let val;
        if (expr.indexOf('{{') !== -1) {
            // 
            val = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
                return this.getVal(args[1], vm);
            })
        }else{ //也可能是v-text='obj.name' v-text='msg'
            val = this.getVal(expr,vm);
        }
        this.updater.textUpdater(node, val);
    },
    html(node, expr, vm) {
        // html处理 非常简单 直接取值 然后调用更新函数即可
        let val = this.getVal(expr,vm);
        this.updater.htmlUpdater(node,val);
    },
    model(node, expr, vm) {
        const val = this.getVal(expr,vm);
        this.updater.modelUpdater(node,val);
    },
    // 对事件进行处理
    on(node, expr, vm, eventName) {
        // 获取事件函数
        let fn = vm.$options.methods && vm.$options.methods[expr];
        // 添加事件 因为我们使用vue时 都不需要关心this的指向问题,这是因为源码的内部帮咱们处理了this的指向
        node.addEventListener(eventName,fn.bind(vm),false);
    },
    // 绑定属性 简单的属性 已经处理 类名样式的绑定有点复杂 因为对应的值可能是对象 也可能是数组 大家根据个人能力尝试写一下
    bind(node,expr,vm,attrName){
        let attrVal = this.getVal(expr,vm);
        this.updater.attrUpdater(node,attrName,attrVal);
    },
    updater: {
        attrUpdater(node, attrName, attrVal){
            node.setAttribute(attrName,attrVal);
        },
        modelUpdater(node,value){
            node.value = value;
        },
        textUpdater(node, value) {
            node.textContent = value;
        },
        htmlUpdater(node,value){
            node.innerHTML = value;
        }
    }

}
```
通过以上操作:我们实现了一个编译器compile,用它来解析指令,通过updater初始化视图.
### 实现数据监听器Observer

我们知道可以利用Obeject.defineProperty()来监听属性变动 那么将需要observe的数据对象进行递归遍历，包括子属性对象的属性，都加上 setter和getter 这样的话，给这个对象的某个值赋值，就会触发setter，那么就能监听到了数据变化。
```
// 创建一个数据监听者  劫持并监听所有数据的变化
class Observer{
    constructor(data) {
        this.observe(data);
    }
    observe(data){
        // 如果当前data是一个对象才劫持并监听
        if(data && typeof data === 'object'){
            // 遍历对象的属性做监听
            Object.keys(data).forEach(key=>{
                this.defineReactive(data,key,data[key]);
            })
            
        }
    }
    defineReactive(obj,key,value){
        // 循环递归 对所有层的数据进行观察
        this.observe(value);//这样obj也能被观察了
        Object.defineProperty(obj,key,{
            get(){
                return value;
            },
            set:(newVal)=>{
                if (newVal !== value){
                    // 如果外界直接修改对象 则对新修改的值重新观察
                    this.observe(newVal);
                    value = newVal;
                    // 通知变化
                    dep.notify();
                }
            }
        })
    }
}
```
这样我们已经可以监听每个数据的变化了，那么监听到变化之后就是怎么通知订阅者了，所以接下来我们需要实现一个消息订阅器，很简单，维护一个数组，用来收集订阅者，数据变动触发notify，再调用订阅者的update方法，代码改善之后是这样：
#### 创建Dep
包括： 添加订阅者和定义通知的方法
```
class Dep{
    constructor() {
        this.subs = []
    }
    // 添加订阅者
    addSub(watcher){
        this.subs.push(watcher);
 
    }
    // 通知变化
    notify(){
        // 观察者中有个update方法 来更新视图
        this.subs.forEach(w=>w.update());
    }
}
```
虽然我们已经创建了Observer,Dep(订阅器),那么问题来了，谁是订阅者？怎么往订阅器添加订阅者？
没错，上面的思路整理中我们已经明确订阅者应该是Watcher, 而且const dep = new Dep();是在 defineReactive方法内部定义的，所以想通过dep添加订阅者，就必须要在闭包内操作，所以我们可以在 getOldVal里面动手脚：

### 实现Watcher
作为连接Observer和Compile的桥梁，能够订阅并收到每个属性变动的通知，执行指令绑定的相应回调函数，从而更新视图
只要所做事情:
1、在自身实例化时往属性订阅器(dep)里面添加自己
2、自身必须有一个update()方法
3、待属性变动dep.notify()通知时，能调用自身的update()方法，并触发Compile中绑定的回调，就完成了它所有的事情。
```
//Watcher
class Watcher{
    constructor(vm,expr,cb) {
        // 观察新值和旧值的变化,如果有变化 更新视图
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        // 先把旧值存起来  
        this.oldVal = this.getOldVal();
    }
    getOldVal(){
        Dep.target = this;
        let oldVal = compileUtil.getVal(this.expr,this.vm);
        Dep.target = null;
        return oldVal;
    }
    update(){
        // 更新操作 数据变化后 Dep会发生通知 告诉观察者更新视图
        let newVal = compileUtil.getVal(this.expr, this.vm);
        if(newVal !== this.oldVal){
            this.cb(newVal);
        }
    }
}

//Observer
defineReactive(obj,key,value){
    // 循环递归 对所有层的数据进行观察
    this.observe(value);//这样obj也能被观察了
    const dep = new Dep();
    Object.defineProperty(obj,key,{
        get(){
            //订阅数据变化,往Dep中添加观察者
            Dep.target && dep.addSub(Dep.target);
            return value;
        },
        //....省略
    })
}
```
我们在什么时候来添加绑定watcher呢?我们看上面的图可以发现：当我们订阅数据变化时,来绑定更新函数,从而让watcher去更新视图，修改代码如下：
```
// 编译模板工具类
const compileUtil = {
    // 获取值的方法
    getVal(expr, vm) {
        return expr.split('.').reduce((data, currentVal) => {
            return data[currentVal]
        }, vm.$data)
    },
    //设置值
    setVal(vm,expr,val){
        return expr.split('.').reduce((data, currentVal, index, arr) => {
            return data[currentVal] = val
        }, vm.$data)
    },
    //获取新值 对{{a}}--{{b}} 这种格式进行处理
    getContentVal(expr, vm) {
        return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getVal(args[1], vm);
        })
    },
    text(node, expr, vm) { //expr 可能是 {{obj.name}}--{{obj.age}} 
        let val;
        if (expr.indexOf('{{') !== -1) {
            // 
            val = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
                //绑定watcher从而更新视图
                new Watcher(vm,args[1],()=>{           
                    this.updater.textUpdater(node,this.getContentVal(expr, vm));
                })
                return this.getVal(args[1], vm);
            })
        }else{ //也可能是v-text='obj.name' v-text='msg'
            val = this.getVal(expr,vm);
        }
        this.updater.textUpdater(node, val);

    },
    html(node, expr, vm) {
        // html处理 非常简单 直接取值 然后调用更新函数即可
        let val = this.getVal(expr,vm);
        // 订阅数据变化时 绑定watcher,从而更新函数
        new Watcher(vm,expr,(newVal)=>{
            this.updater.htmlUpdater(node, newVal);
        })
        this.updater.htmlUpdater(node,val);
    },
    model(node, expr, vm) {
        const val = this.getVal(expr,vm);
        // 订阅数据变化时 绑定更新函数 更新视图的变化

        // 数据==>视图
        new Watcher(vm, expr, (newVal) => {
            this.updater.modelUpdater(node, newVal);
        })
        // 视图==>数据
        node.addEventListener('input',(e)=>{
            // 设置值
            this.setVal(vm,expr,e.target.value);

        },false);
        this.updater.modelUpdater(node,val);
    },
    // 对事件进行处理
    on(node, expr, vm, eventName) {
        // 获取事件函数
        let fn = vm.$options.methods && vm.$options.methods[expr];
        // 添加事件 因为我们使用vue时 都不需要关心this的指向问题,这是因为源码的内部帮咱们处理了this的指向
        node.addEventListener(eventName,fn.bind(vm),false);
    },
    // 绑定属性 简单的属性 已经处理 类名样式的绑定有点复杂 因为对应的值可能是对象 也可能是数组 大家根据个人能力尝试写一下
    bind(node,expr,vm,attrName){
        let attrVal = this.getVal(expr,vm);
        this.updater.attrUpdater(node,attrName,attrVal);
    },
    updater: {
        attrUpdater(node, attrName, attrVal){
            node.setAttribute(attrName,attrVal);
        },
        modelUpdater(node,value){
            node.value = value;
        },
        textUpdater(node, value) {
            node.textContent = value;
        },
        htmlUpdater(node,value){
            node.innerHTML = value;
        }
    }

}
```
至此，我们将Compile、Observe、Watcher三个类关联起来，实现了MVVM；
### 总结
最后，总结一下MVVM响应式原理:

Vue.js 则是采用数据劫持结合发布者-订阅者模式的方式，通过Object.defineProperty()来劫持各个属性的setter，getter，在数据变动时发布消息给订阅者，触发相应的监听回调。
MVVM作为数据绑定的入口，整合Observer、Compile和Watcher三者，通过Observer来监听自己的model数据变化，通过Compile来解析编译模板指令，最终利用Watcher搭起Observer和Compile之间的通信桥梁，达到数据变化 -> 视图更新；视图交互变化(input) -> 数据model变更的双向绑定效果.

附上WVue.js所有代码：
```
String.prototype.startWith=function(str){ 
    if(str==null||str==""||this.length==0||str.length>this.length) 
     return false; 
    if(this.substr(0,str.length)==str) 
      return true; 
    else
      return false; 
    return true; 
}
class Watcher {
    constructor(expr, vm, cb) {
        this.expr = expr;
        this.vm = vm;
        this.cb = cb;
        this.oldValue = this.getOldValue();
    }
    getOldValue() {
        // 在利用getValue获取数据调用getter()方法时先把当前观察者挂载
        Dep.target = this;
        const oldValue = compileUtil.getValue(this.expr, this.vm);
        // 挂载完毕需要注销，防止重复挂载 (数据一更新就会挂载)
        Dep.target = null;
        return oldValue;
    }
    // 通过回调函数更新数据
    update() {
        const newVal = compileUtil.getValue(this.expr, this.vm);
        if(newVal !== this.oldValue) {
            this.cb(newVal)
        }
    }
}


// Dep类存储watcher对象，并在数据变化时通知watcher
class Dep {
    constructor() {
        this.watcherCollector = [];
    }
    // 添加watcher
    addWatcher(watcher) {
        this.watcherCollector.push(watcher)
    }
    // 数据变化时通知watcher更新视图
    notify() {
        this.watcherCollector.forEach(w=>w.update())
    }
}

class Observer {
    constructor(data) {
        this.observe(data)
    }
    // data是一个对象，可能存在嵌套对象，所以需要使用递归遍历的方式进行观察者绑定
    observe(data) {
        if(data && typeof data === 'object') {
            Object.keys(data).forEach(key => {
                this.defineReactive(data,key,data[key])
            })
        }
    }
    // 通过 object.defineProperty方法对对象属性进行劫持
    defineReactive(obj,key,value) {
        // 递归观察value是否是对象，还需要继续观察
        this.observe(value)
        const dep = new Dep()
        Object.defineProperty(obj, key, {
            enumerable: true,
            configurable: false,
            get: () => {
                // 订阅数据变化时，往Dep中添加观察者
                Dep.target && dep.addWatcher(Dep.target)
                return value;
            },
            set: (newVal) => {
                if(value !== newVal) {
                    value = newVal
                    // 通知watcher数据发生改变
                    dep.notify();
                }
            }
        })
    }
}

const compileUtil = {
    getValue(expr, vm) {
        // 处理 person.name 这种对象类型，取出真正的value
        return expr.split('.').reduce((data, currentVal) => {
            return data[currentVal];
        }, vm.$data)
    },
    setVal(expr, vm, inputValue){
        const exprs = expr.split('.'), len = exprs.length;
        exprs.reduce((data,currentVal, idx)=>{
            if(idx===len-1){
                data[currentVal] = inputValue;
            }else{
                return data[currentVal]
            }
        }, vm.$data)
    },
    getContent(expr, vm){
        // {{person.name}}--{{person.age}}
        // 防止修改person.name使得所有值全部被替换
        return expr.replace(/\{\{(.+?)\}\}/g, (...args)=>{
            return this.getValue(args[1], vm);
        });
    },
    text(node, expr, vm) {
        let value;
        if(expr.indexOf('{{')!==-1){
            value = expr.replace(/\{\{(.+?)\}\}/g, (...args)=>{
                // // text的 Watcher应在此绑定，因为是对插值{{}}进行双向绑定
                // // Watcher的构造函数的 getOldVal()方法需要接受数据或者对象，而{{person.name}}不能接收
                new Watcher(args[1], vm, ()=>{
                    this.updater.textUpdater(node, this.getContent(expr, vm));
                });
                return this.getValue(args[1], vm);
            });
        }else{
            value = this.getValue(expr, vm);
        }
        this.updater.textUpdater(node, value)
    },
    html(node, expr, vm) {
        let value = this.getValue(expr, vm);
        new Watcher(expr, vm, (newValue) => {
            this.updater.htmlUpdater(node,newValue)
        })
        this.updater.htmlUpdater(node,value)
    },
    model(node, expr, vm) {
        const value = this.getValue(expr, vm);
        // v-model绑定对应的watcher，数据=>视图
        new Watcher(expr, vm, (newValue) => {
            this.updater.modelUpdater(node,newValue)
        })
        // 视图=>数据=>视图
        node.addEventListener('input',(e)=> {
            this.setVal(expr, vm, e.target.value)
        })
        this.updater.modelUpdater(node, value);
    },
    on(node, expr, vm, detailStr) {
        let fn = vm.$options.methods && vm.$options.methods[expr].bind(vm);
        node.addEventListener(detailStr,fn, false);
    },
    bind(node, expr, vm, detailStr){
        // v-on:href='...' => href='...'
        node.setAttribute(detailStr, expr);
    },
    // 视图更新函数对象
    updater: {
        textUpdater(node, value) {
            node.textContent = value;
        },
        htmlUpdater(node, value) {
            node.innerHTML = value;
        },
        modelUpdater(node, value){
            node.value = value;
        }
    }
}

// 编译HTML模板
class Compiler {
    constructor(el, vm) {
        this.el = this.isElementNode(el) ? el : document.getElementById(el);
        this.vm = vm;
        // 将预编译的元素节点放入文档碎片对象中，避免DOM频繁的回流与重绘，提高渲染性能
        const fragments = this.node2fragments(this.el);
        // 编译模板
        this.compile(fragments)
        // 追加子元素到根元素
        this.el.appendChild(fragments);
    }
    compile(fragments) {
        const childNodes = fragments.childNodes;
        Array.from(childNodes).forEach(child => {
            if(this.isElementNode(child)) {
                // 元素节点
                // console.log('元素节点',child)
                this.compileElement(child)
            }else {
                // 文本节点
                // console.log('文本节点',child)
                this.compileText(child);
            }
            //递归遍历 , 确保每一个子节点都能够编译到
            if(child.childNodes && child.childNodes.length){
                this.compile(child);
            }
        })
    }
    compileText(node) {
        // 编译{{person.name}}
        const content = node.textContent;
        if(/\{\{(.+?)\}\}/.test(content)) {
            compileUtil['text'](node, content, this.vm)
        }
    }
    compileElement(node) {
        let attributes = node.attributes;
        Array.from(attributes).forEach(attr => {
            const {name, value} = attr;
            if(this.isDirector(name)) { // v-text  v-html  v-mode  v-bind  v-on:click v-bind:href=''
                const [,directive] = name.split('-');
                const [compileKey, detailStr] = directive.split(':');
                // 更新数据  数据驱动视图更新
                compileUtil[compileKey](node, value, this.vm, detailStr)
                // 删除所有有指令的标签属性，即以“v-”开头的属性
                node.removeAttribute(name)
            }else if(this.isEventName(name)) {
                // 如果是事件处理 @click='handleClick'
                let [, detailStr] = name.split('@');
                compileUtil['on'](node, value, this.vm, detailStr);
                node.removeAttribute('@' + detailStr);
            }
        })
    }
    isEventName(attrName) {
        // 判断是否@开头
        return attrName.startsWith('@');
    }
    // 判断是否是vue的特性属性标签
    isDirector(attrName) {
        return attrName.startWith('v-')
    }
    node2fragments(el) {
        const f = document.createDocumentFragment();
        let firstChild;
        while (firstChild = el.firstChild) {
            f.appendChild(firstChild);
        }
        return f;
    }
    isElementNode(node) {
        // 元素节点的nodeType属性为 1
        return node.nodeType === 1;
    }
}

class WVue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        this.$options = options;
        if(this.$el) {
            //创建观察者
            new Observer(this.$data)
            // 编译模板指令
            new Compiler(this.$el, this)
            // 通过数据代理实现 this.person.name = 'whg'功能，而不是this.$data.person.name = 'whg'
            this.proxyData(this.$data);
        }
    }
    // 使用vm代理vm.$data
    proxyData(data) {
        for(let key in data) {
            Object.defineProperty(this,key, {
                get: () => {
                    return data[key]
                },
                set: (newVal)=> {
                    data[key] = newVal
                }
            })
        }
    }
}
```


